import { SERVER_BASE } from "./endpoint";
import type { GardenSnapshot, PlantChange, PlantRecords } from "./types";

/**
 * Die HTTP-Schicht zum Sync-Dienst. Bewusst dünn: Zusammenführen passiert im
 * Server und in `merge.ts`, hier geht es nur um Anfragen und darum, die drei
 * Fehlerfälle auseinanderzuhalten, die die App unterschiedlich behandeln muss.
 */

export type SyncFailure =
  /** Kein Netz, Server aus, Zeitüberschreitung -- später erneut versuchen. */
  | { kind: "offline" }
  /** Code fehlt oder ist falsch -- nach dem Code fragen. */
  | { kind: "unauthorized" }
  /** Der Server hat die Anfrage abgelehnt; erneutes Senden hilft nicht. */
  | { kind: "rejected"; status: number; message: string };

export type SyncResult<T> = { ok: true; value: T } | { ok: false; failure: SyncFailure };

/** Antwort auf ein Nachfragen: entweder ein Stand oder "unverändert". */
export type PullResult = GardenSnapshot | { revision: number; unchanged: true };

export const isUnchanged = (result: PullResult): result is { revision: number; unchanged: true } =>
  "unchanged" in result;

const REQUEST_TIMEOUT_MS = 12_000;

const request = async <T>(
  passcode: string,
  path: string,
  init: RequestInit = {},
): Promise<SyncResult<T>> => {
  try {
    const response = await fetch(`${SERVER_BASE}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${passcode}`, ...init.headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 401 || response.status === 429) return { ok: false, failure: { kind: "unauthorized" } };
    if (!response.ok) {
      return {
        ok: false,
        failure: { kind: "rejected", status: response.status, message: await response.text().catch(() => "") },
      };
    }
    return { ok: true, value: (await response.json()) as T };
  } catch {
    // fetch wirft bei fehlendem Netz, DNS-Problemen und Zeitüberschreitung.
    return { ok: false, failure: { kind: "offline" } };
  }
};

/** Holt den Stand. Bei gleicher Revision antwortet der Server ohne Daten. */
export const pullGarden = (passcode: string, revision: number): Promise<SyncResult<PullResult>> =>
  request<PullResult>(passcode, `/api/garden?revision=${revision}`);

/** Schickt Änderungen und bekommt den zusammengeführten Gesamtstand zurück. */
export const pushGarden = (passcode: string, changes: PlantChange[]): Promise<SyncResult<GardenSnapshot>> =>
  request<GardenSnapshot>(passcode, "/api/garden", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ changes }),
  });

/** Lädt ein Foto hoch und gibt den Pfad zurück, der synchronisiert wird. */
export const uploadPhoto = (
  passcode: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<SyncResult<{ photoUri: string }>> =>
  request<{ photoUri: string }>(passcode, "/api/photos", {
    method: "POST",
    headers: { "content-type": contentType },
    body: bytes as unknown as BodyInit,
  });

/** Prüft einen eingegebenen Code, ohne etwas zu verändern. */
export const checkPasscode = async (passcode: string): Promise<SyncResult<PlantRecords>> => {
  const result = await pullGarden(passcode, -1);
  if (!result.ok) return result;
  return { ok: true, value: isUnchanged(result.value) ? {} : result.value.records };
};
