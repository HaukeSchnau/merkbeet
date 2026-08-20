import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolvePlants } from "../src/sync/merge";
import type { GardenSnapshot, PlantChange } from "../src/sync/types";

/**
 * Fährt den echten Server in einem eigenen Prozess hoch und spricht ihn über
 * HTTP an -- Auth, Schema, Transaktion und SQLite werden also mitgeprüft.
 */

const PASSCODE = "test-code-fuer-die-familie";
const PORT = 8791;
const base = `http://127.0.0.1:${PORT}`;

let stateDir: string;
let child: ReturnType<typeof Bun.spawn>;

const api = (path: string, init: RequestInit = {}) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${PASSCODE}`, "content-type": "application/json", ...init.headers },
  });

const push = async (changes: PlantChange[]): Promise<GardenSnapshot> => {
  const response = await api("/api/garden", { method: "POST", body: JSON.stringify({ changes }) });
  expect(response.status).toBe(200);
  return (await response.json()) as GardenSnapshot;
};

beforeAll(async () => {
  stateDir = mkdtempSync(join(tmpdir(), "merkbeet-test-"));
  child = Bun.spawn(["bun", "server/index.ts"], {
    env: { ...process.env, MERKBEET_PORT: String(PORT), MERKBEET_STATE_DIR: stateDir, MERKBEET_PASSCODE: PASSCODE },
    stdout: "pipe",
    stderr: "pipe",
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(`${base}/healthz`)).ok) return;
    } catch {
      // Server noch nicht bereit.
    }
    await Bun.sleep(100);
  }
  throw new Error("Server ist nicht gestartet");
});

afterAll(() => {
  child?.kill();
  rmSync(stateDir, { recursive: true, force: true });
});

describe("Zugang", () => {
  it("weist Anfragen ohne Code ab", async () => {
    expect((await fetch(`${base}/api/garden`)).status).toBe(401);
  });

  it("weist einen falschen Code ab", async () => {
    const response = await fetch(`${base}/api/garden`, { headers: { authorization: "Bearer falsch" } });
    expect(response.status).toBe(401);
  });

  it("lässt Fotos ohne Code abrufen, aber nicht hochladen", async () => {
    expect((await fetch(`${base}/api/photos`, { method: "POST" })).status).toBe(401);
    expect((await fetch(`${base}/api/photos/nichtexistent.jpg`)).status).toBe(404);
  });
});

describe("Schema", () => {
  it("weist unbekannte Arten ab", async () => {
    const response = await api("/api/garden", {
      method: "POST",
      body: JSON.stringify({ changes: [{ id: "x", speciesId: "kaktus" }] }),
    });
    expect(response.status).toBe(400);
  });

  it("weist unsinnige Durchmesser ab", async () => {
    const response = await api("/api/garden", {
      method: "POST",
      body: JSON.stringify({ changes: [{ id: "rose-w1", fields: { diameterMeters: 9999 } }] }),
    });
    expect(response.status).toBe(400);
  });
});

describe("Sync", () => {
  it("zählt die Revision hoch und gibt den Stand zurück", async () => {
    const before = ((await (await api("/api/garden")).json()) as GardenSnapshot).revision;
    const after = await push([{ id: "rose-w1", fields: { notes: "erste Notiz" } }]);
    expect(after.revision).toBe(before + 1);
    expect(after.records["rose-w1"].fields.notes?.value).toBe("erste Notiz");
  });

  it("antwortet bei unveränderter Revision ohne Daten", async () => {
    const snapshot = (await (await api("/api/garden")).json()) as GardenSnapshot;
    const again = await (await api(`/api/garden?revision=${snapshot.revision}`)).json();
    expect(again).toEqual({ revision: snapshot.revision, unchanged: true });
  });

  it("führt gleichzeitige Änderungen an verschiedenen Feldern zusammen", async () => {
    await push([{ id: "hydrangea-s1", fields: { position: { x: 5, y: 6 } } }]);
    const snapshot = await push([{ id: "hydrangea-s1", fields: { notes: "von der Mutter" } }]);

    const plant = resolvePlants(snapshot.records).find((p) => p.id === "hydrangea-s1");
    expect(plant?.position).toEqual({ x: 5, y: 6 });
    expect(plant?.notes).toBe("von der Mutter");
  });

  it("hält drei gleichzeitig sendende Geräte auseinander", async () => {
    const snapshots = await Promise.all([
      push([{ id: "rose-s1", fields: { notes: "Vater" } }]),
      push([{ id: "rose-s2", fields: { notes: "Mutter" } }]),
      push([{ id: "rose-s3", fields: { notes: "PC" } }]),
    ]);
    // Jede Änderung muss angekommen sein, egal wer zuerst dran war.
    const final = (await (await api("/api/garden")).json()) as GardenSnapshot;
    expect(final.records["rose-s1"].fields.notes?.value).toBe("Vater");
    expect(final.records["rose-s2"].fields.notes?.value).toBe("Mutter");
    expect(final.records["rose-s3"].fields.notes?.value).toBe("PC");
    // Und jede Antwort muss eine eigene Revision getragen haben.
    expect(new Set(snapshots.map((s) => s.revision)).size).toBe(3);
  });

  it("nimmt ein Foto an und liefert es wieder aus", async () => {
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d494844520000000100000001080600000" + "01f15c4890000000a49444154789c6300010000050001".padEnd(46, "0"),
      "hex",
    );
    const upload = await fetch(`${base}/api/photos`, {
      method: "POST",
      headers: { authorization: `Bearer ${PASSCODE}`, "content-type": "image/png" },
      body: png,
    });
    expect(upload.status).toBe(200);
    const { photoUri } = (await upload.json()) as { photoUri: string };
    expect(photoUri).toMatch(/^\/api\/photos\/[a-f0-9]{32}\.png$/);

    const fetched = await fetch(`${base}${photoUri}`);
    expect(fetched.status).toBe(200);
    expect(new Uint8Array(await fetched.arrayBuffer()).length).toBe(png.length);
  });

  it("lehnt Dateien ab, die keine Bilder sind", async () => {
    const response = await fetch(`${base}/api/photos`, {
      method: "POST",
      headers: { authorization: `Bearer ${PASSCODE}`, "content-type": "application/zip" },
      body: Buffer.from("PK"),
    });
    expect(response.status).toBe(415);
  });
});

describe("Dauerhaftigkeit", () => {
  it("hält den Stand über einen Neustart", async () => {
    await push([{ id: "grass-w1", fields: { name: "Haaresgras" } }]);
    child.kill();
    await child.exited;

    child = Bun.spawn(["bun", "server/index.ts"], {
      env: { ...process.env, MERKBEET_PORT: String(PORT), MERKBEET_STATE_DIR: stateDir, MERKBEET_PASSCODE: PASSCODE },
      stdout: "pipe",
      stderr: "pipe",
    });
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        if ((await fetch(`${base}/healthz`)).ok) break;
      } catch {
        // noch nicht bereit
      }
      await Bun.sleep(100);
    }

    const snapshot = (await (await api("/api/garden")).json()) as GardenSnapshot;
    expect(snapshot.records["grass-w1"].fields.name?.value).toBe("Haaresgras");
  });
});
