import { GARDEN_PLAN } from "../garden/plan";
import type { Plant, PlantEdits, PlantId } from "../garden/types";
import { EDITABLE_FIELDS, type EditableField, type FieldValue, type PlantChange, type PlantRecord, type PlantRecords } from "./types";

/**
 * Zusammenfuehren von Gartenstaenden.
 *
 * Regel: pro **Feld** gewinnt der juengere Zeitstempel, nicht pro Pflanze.
 * Pflanzenweit zu gewinnen waere weniger Code, wuerde aber genau den
 * Alltagsfall verlieren: einer setzt am Pflanztag Positionen um, waehrend die
 * andere Notizen schreibt. Eine der beiden Arbeiten waere stillschweigend weg.
 *
 * Alles hier ist rein und wird von Client und Server gemeinsam benutzt.
 */

/** Stabiler Vergleich zweier Feldwerte -- `position` ist ein Objekt. */
const sameValue = (a: FieldValue | undefined, b: FieldValue | undefined): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Entscheidet zwischen zwei Staenden desselben Feldes. Bei gleichem
 * Zeitstempel gewinnt der lexikografisch groessere Wert. Das ist inhaltlich
 * willkuerlich, aber notwendig: ohne festen Ausgang bei Gleichstand koennten
 * zwei Geraete sich endlos gegenseitig ueberschreiben.
 */
const laterOf = <T extends { at: number; value: unknown }>(a: T | undefined, b: T | undefined): T | undefined => {
  if (!a) return b;
  if (!b) return a;
  if (a.at !== b.at) return a.at > b.at ? a : b;
  return JSON.stringify(a.value ?? null) >= JSON.stringify(b.value ?? null) ? a : b;
};

const mergeRecord = (a: PlantRecord, b: PlantRecord): PlantRecord => {
  const fields: PlantRecord["fields"] = {};
  for (const field of EDITABLE_FIELDS) {
    const winner = laterOf(a.fields[field], b.fields[field]);
    if (winner) fields[field] = winner;
  }
  const removed = laterOf(a.removed, b.removed);
  const speciesId = a.speciesId ?? b.speciesId;
  return {
    id: a.id,
    // Die Art einer selbst gesetzten Pflanze aendert sich nie und wird deshalb
    // nicht zusammengefuehrt, sondern uebernommen.
    ...(speciesId ? { speciesId } : {}),
    fields,
    ...(removed ? { removed } : {}),
  };
};

/**
 * Fuehrt zwei Staende zusammen. Kommutativ und assoziativ: egal in welcher
 * Reihenfolge und wie oft Geraete synchronisieren, alle landen beim selben
 * Ergebnis.
 */
export const mergeRecords = (a: PlantRecords, b: PlantRecords): PlantRecords => {
  const merged: PlantRecords = { ...a };
  for (const [id, record] of Object.entries(b)) {
    const existing = merged[id];
    merged[id] = existing ? mergeRecord(existing, record) : record;
  }
  return merged;
};

/**
 * Traegt die Aenderung eines Geraets ein. `at` ist die Serverzeit der Annahme.
 * Ein Feld wird nur angefasst, wenn der Wert sich wirklich unterscheidet --
 * sonst wuerde ein blosses Wiederschicken fremde, neuere Aenderungen
 * verdraengen.
 */
export const applyChange = (record: PlantRecord | undefined, change: PlantChange, at: number): PlantRecord => {
  const next: PlantRecord = record
    ? { ...record, fields: { ...record.fields } }
    : { id: change.id, fields: {} };

  if (change.speciesId && !next.speciesId) next.speciesId = change.speciesId;

  for (const field of EDITABLE_FIELDS) {
    if (!change.fields || !(field in change.fields)) continue;
    const value = change.fields[field] ?? null;
    if (sameValue(next.fields[field]?.value, value)) continue;
    next.fields[field] = { value, at };
  }

  if (change.removed !== undefined && next.removed?.value !== change.removed) {
    next.removed = { value: change.removed, at };
  }
  return next;
};

export const applyChanges = (records: PlantRecords, changes: PlantChange[], at: number): PlantRecords => {
  const next: PlantRecords = { ...records };
  for (const change of changes) next[change.id] = applyChange(next[change.id], change, at);
  return next;
};

/**
 * Liest ein Feld mit seinem echten Typ aus dem Stand. Hier -- und nur hier --
 * wird die undurchsichtige Wert-Vereinigung wieder an `PlantEdits` gebunden.
 */
const readField = <K extends EditableField>(
  fields: PlantRecord["fields"],
  field: K,
): PlantEdits[K] | undefined => {
  const state = fields[field];
  if (!state || state.value === null) return undefined;
  return state.value as PlantEdits[K];
};

/** Nur gesetzte Schluessel; sonst wuerde `undefined` Werte aus dem Plan loeschen. */
const definedOnly = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;

const editsOf = (fields: PlantRecord["fields"]): PlantEdits =>
  definedOnly({
    name: readField(fields, "name"),
    position: readField(fields, "position"),
    diameterMeters: readField(fields, "diameterMeters"),
    plantedAt: readField(fields, "plantedAt"),
    notes: readField(fields, "notes"),
    photoUri: readField(fields, "photoUri"),
  });

/**
 * Baut aus Plan und Sync-Stand die Pflanzenliste fuer die Anzeige.
 * Neue Pflanzen ohne Position landen bei (0,0) -- das kommt nicht vor, weil
 * `addPlant` immer eine Position mitgibt, ist aber der harmlose Ausweg.
 */
export const resolvePlants = (records: PlantRecords, seed: Plant[] = GARDEN_PLAN.plants): Plant[] => {
  const seedIds = new Set(seed.map((plant) => plant.id));
  const plants: Plant[] = [...seed];

  // Selbst hinzugefuegte Pflanzen kennt der Plan nicht; sie stecken allein im
  // Sync-Stand und tragen deshalb ihre Art selbst.
  for (const record of Object.values(records)) {
    if (seedIds.has(record.id) || !record.speciesId) continue;
    plants.push({ id: record.id, speciesId: record.speciesId, position: { x: 0, y: 0 } });
  }

  return plants
    .filter((plant) => !records[plant.id]?.removed?.value)
    .map((plant) => {
      const fields = records[plant.id]?.fields;
      return fields ? { ...plant, ...editsOf(fields) } : plant;
    });
};

/** Fasst mehrere Aenderungen an derselben Pflanze zu einer zusammen. */
export const coalesceChange = (existing: PlantChange | undefined, change: PlantChange): PlantChange => {
  const speciesId = existing?.speciesId ?? change.speciesId;
  const removed = change.removed ?? existing?.removed;
  const fields =
    existing?.fields || change.fields ? { ...existing?.fields, ...change.fields } : undefined;
  return {
    id: change.id,
    ...(speciesId ? { speciesId } : {}),
    ...(fields ? { fields } : {}),
    ...(removed === undefined ? {} : { removed }),
  };
};

/** Ids aller Pflanzen im Stand, sortiert -- fuer Tests und Diagnose. */
export const recordIds = (records: PlantRecords): PlantId[] => Object.keys(records).sort();
