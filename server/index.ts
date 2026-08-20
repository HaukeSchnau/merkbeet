import { timingSafeEqual } from "node:crypto";

import { pushRequestSchema } from "./schema";
import { loadConfig, type ServerConfig } from "./config";
import { PhotoStore, MAX_PHOTO_BYTES } from "./photos";
import { GardenStore } from "./store";

/**
 * Merkbeet-Sync: hält den Gartenstand für alle Geräte der Familie und liefert
 * gleich den Web-Client mit aus. Ein Dienst, eine Herkunft -- damit entfällt
 * CORS, und die App kann ihren Server einfach über relative Pfade ansprechen.
 */

const config = await loadConfig();
const garden = new GardenStore(config.stateDir);
const photos = new PhotoStore(config.stateDir);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

/** Zeitkonstanter Vergleich, damit sich der Code nicht Zeichen für Zeichen erraten lässt. */
const codeMatches = (given: string, expected: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Einfache Drosselung pro Absender. Der Code ist lang, aber ein offener
 * Endpunkt sollte trotzdem nicht beliebig oft geraten werden dürfen.
 */
const FAILURE_LIMIT = 12;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; until: number }>();

const clientKey = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unbekannt";

const isLockedOut = (key: string): boolean => {
  const entry = failures.get(key);
  if (!entry) return false;
  if (entry.until < Date.now()) {
    failures.delete(key);
    return false;
  }
  return entry.count >= FAILURE_LIMIT;
};

const noteFailure = (key: string): void => {
  const entry = failures.get(key);
  const until = Date.now() + FAILURE_WINDOW_MS;
  failures.set(key, entry && entry.until > Date.now() ? { count: entry.count + 1, until: entry.until } : { count: 1, until });
};

type Authorized = { ok: true } | { ok: false; response: Response };

const authorize = (request: Request, cfg: ServerConfig): Authorized => {
  const key = clientKey(request);
  if (isLockedOut(key)) {
    return { ok: false, response: json({ error: "zu viele Versuche" }, 429) };
  }
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!given || !codeMatches(given, cfg.passcode)) {
    noteFailure(key);
    return { ok: false, response: json({ error: "Zugangscode falsch" }, 401) };
  }
  failures.delete(key);
  return { ok: true };
};

/** Liefert den exportierten Web-Client; unbekannte Pfade landen auf index.html. */
const serveWeb = async (pathname: string): Promise<Response> => {
  const candidate = Bun.file(`${config.webDir}${pathname === "/" ? "/index.html" : pathname}`);
  if (await candidate.exists()) return new Response(candidate);
  const index = Bun.file(`${config.webDir}/index.html`);
  if (await index.exists()) return new Response(index);
  return new Response("Web-Client nicht gebaut", { status: 404 });
};

const server = Bun.serve({
  hostname: config.hostname,
  port: config.port,
  idleTimeout: 30,
  maxRequestBodySize: MAX_PHOTO_BYTES + 1024,

  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/healthz") return new Response("ok");

    // Fotos: die zufällige Adresse ist der Schlüssel, siehe photos.ts.
    if (request.method === "GET" && pathname.startsWith("/api/photos/")) {
      const handle = photos.find(pathname.slice("/api/photos/".length));
      if (!handle || !(await handle.exists())) return new Response("nicht gefunden", { status: 404 });
      return new Response(handle, { headers: { "cache-control": "public, max-age=31536000, immutable" } });
    }

    if (pathname === "/api/garden" || pathname === "/api/photos") {
      const auth = authorize(request, config);
      if (!auth.ok) return auth.response;
    }

    if (pathname === "/api/garden" && request.method === "GET") {
      const snapshot = garden.snapshot();
      const known = Number(url.searchParams.get("revision"));
      // Der Normalfall beim Nachfragen: nichts hat sich geändert.
      if (Number.isFinite(known) && known === snapshot.revision) {
        return json({ revision: snapshot.revision, unchanged: true });
      }
      return json(snapshot);
    }

    if (pathname === "/api/garden" && request.method === "POST") {
      const parsed = pushRequestSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return json({ error: "Anfrage passt nicht zum Schema" }, 400);
      return json(garden.push(parsed.data.changes));
    }

    if (pathname === "/api/photos" && request.method === "POST") {
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength === 0) return json({ error: "leeres Bild" }, 400);
      if (bytes.byteLength > MAX_PHOTO_BYTES) return json({ error: "Bild zu groß" }, 413);
      const path = await photos.save(bytes, request.headers.get("content-type"));
      if (!path) return json({ error: "Bildformat nicht unterstützt" }, 415);
      return json({ photoUri: path });
    }

    if (pathname.startsWith("/api/")) return json({ error: "unbekannter Endpunkt" }, 404);
    if (request.method !== "GET") return new Response("nur GET", { status: 405 });

    return serveWeb(pathname);
  },
});

console.log(`Merkbeet-Sync auf http://${config.hostname}:${server.port} (Daten in ${config.stateDir})`);
