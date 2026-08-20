import AsyncStorage from "@react-native-async-storage/async-storage";

import type { PlantEdits, PlantId } from "../garden/types";
import { applyChanges } from "../sync/merge";
import type { PlantChange, PlantRecords } from "../sync/types";

const STORAGE_KEY = "merkbeet/garden/v2";
const LEGACY_KEY = "merkbeet/garden/v1";
const PASSCODE_KEY = "merkbeet/passcode";

/**
 * Lokal liegt genau das, was die App zum Arbeiten ohne Netz braucht: der
 * letzte vom Server bestätigte Stand plus die eigenen, noch nicht bestätigten
 * Änderungen. Beides ist die Abweichung vom Plan im Code, nicht der Garten
 * selbst -- Korrekturen an `plan.ts` bleiben also wirksam.
 */
export type LocalGarden = {
  version: 2;
  /** Revision, auf die sich `records` bezieht. */
  revision: number;
  records: PlantRecords;
  /** Eigene Änderungen, zusammengefasst pro Pflanze. */
  pending: Record<PlantId, PlantChange>;
};

export const EMPTY_GARDEN: LocalGarden = { version: 2, revision: 0, records: {}, pending: {} };

/** Das Format vor der Sync-Funktion. Wird beim ersten Start übernommen. */
type LegacyGarden = {
  version: 1;
  edits: Record<PlantId, PlantEdits>;
  added: { id: PlantId; speciesId: string; position: { x: number; y: number } }[];
  removed: PlantId[];
};

const isLocal = (value: unknown): value is LocalGarden =>
  typeof value === "object" && value !== null && (value as LocalGarden).version === 2;

const isLegacy = (value: unknown): value is LegacyGarden =>
  typeof value === "object" && value !== null && (value as LegacyGarden).version === 1;

/**
 * Übernimmt Änderungen aus der Version ohne Sync. Sie werden als eigene,
 * noch nicht bestätigte Änderungen eingetragen und beim ersten Sync
 * hochgeschickt -- so geht nichts verloren, was auf dem Gerät schon stand.
 */
const migrate = (legacy: LegacyGarden): LocalGarden => {
  const pending: Record<PlantId, PlantChange> = {};
  for (const item of legacy.added) {
    pending[item.id] = {
      id: item.id,
      speciesId: item.speciesId as PlantChange["speciesId"],
      fields: { position: item.position },
    };
  }
  for (const [id, edits] of Object.entries(legacy.edits)) {
    pending[id] = {
      ...pending[id],
      id,
      fields: { ...pending[id]?.fields, ...edits },
    };
  }
  for (const id of legacy.removed) {
    pending[id] = { ...pending[id], id, removed: true };
  }
  return { ...EMPTY_GARDEN, pending };
};

export const loadGarden = async (): Promise<LocalGarden> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isLocal(parsed)) return parsed;
    }
    const legacyRaw = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const parsed: unknown = JSON.parse(legacyRaw);
      if (isLegacy(parsed)) return migrate(parsed);
    }
    return EMPTY_GARDEN;
  } catch {
    // Ein kaputter Speicher darf die App nicht blockieren; dann startet sie mit
    // dem Plan aus der Skizze und holt sich den Rest vom Server.
    return EMPTY_GARDEN;
  }
};

export const saveGarden = (garden: LocalGarden): Promise<void> =>
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(garden));

export const loadPasscode = (): Promise<string | null> => AsyncStorage.getItem(PASSCODE_KEY);

export const savePasscode = (passcode: string): Promise<void> =>
  AsyncStorage.setItem(PASSCODE_KEY, passcode);

export const forgetPasscode = (): Promise<void> => AsyncStorage.removeItem(PASSCODE_KEY);

/**
 * Der Stand, den die App anzeigt: bestätigte Daten mit den eigenen Änderungen
 * darüber. Die eigenen gewinnen immer, sonst würde eine gerade getippte Notiz
 * bis zum nächsten Sync wieder verschwinden.
 */
const PENDING_AT = Number.MAX_SAFE_INTEGER;

export const effectiveRecords = (garden: LocalGarden): PlantRecords =>
  applyChanges(garden.records, Object.values(garden.pending), PENDING_AT);
