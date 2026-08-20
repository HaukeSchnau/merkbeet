import type { SpeciesId } from "../garden/species";
import type { PlantEdits, PlantId } from "../garden/types";

/**
 * Der Sync-Stand ist bewusst nicht "der Garten", sondern die Abweichung vom
 * Plan im Code -- genau wie die lokale Speicherung. Damit bleiben Korrekturen
 * an `plan.ts` weiterhin wirksam, und synchronisiert wird nur, was Menschen
 * tatsaechlich geaendert haben.
 *
 * Innerhalb dieser Strukturen sind Feldwerte absichtlich nur als Vereinigung
 * aller moeglichen Werte typisiert: Merge und Transport behandeln sie ohnehin
 * undurchsichtig. Die genauen Typen pro Feld gelten an der Grenze zur App,
 * siehe `readField` in `merge.ts`.
 */

/** Die Felder einer Pflanze, die in der App geaendert werden koennen. */
export type EditableField = keyof PlantEdits;

/** Jeder Wert, der in einem aenderbaren Feld stehen kann. `null` heisst geleert. */
export type FieldValue = NonNullable<PlantEdits[EditableField]> | null;

/**
 * Ein Feld mit dem Zeitpunkt seiner letzten Aenderung. Der Zeitstempel kommt
 * immer vom Server, nie von den Geraeten -- sonst wuerde eine falsch gestellte
 * Handy-Uhr alle anderen dauerhaft ueberstimmen.
 */
export type TimedField = { value: FieldValue; at: number };

export type PlantRecord = {
  id: PlantId;
  /** Nur bei Pflanzen gesetzt, die es im Plan nicht gibt. */
  speciesId?: SpeciesId;
  fields: Partial<Record<EditableField, TimedField>>;
  /** Gesetzt, sobald eine Pflanze entfernt (oder zurueckgeholt) wurde. */
  removed?: { value: boolean; at: number };
};

export type PlantRecords = Record<PlantId, PlantRecord>;

/**
 * Was ein Geraet an den Server schickt. Feld fehlt = unveraendert,
 * `null` = leeren, Wert = setzen.
 */
export type PlantChange = {
  id: PlantId;
  speciesId?: SpeciesId;
  fields?: Partial<Record<EditableField, FieldValue>>;
  removed?: boolean;
};

export type GardenSnapshot = {
  /** Zaehlt bei jeder angenommenen Aenderung hoch. */
  revision: number;
  records: PlantRecords;
};

export type PushRequest = { changes: PlantChange[] };

/** Reihenfolge und Umfang der synchronisierten Felder, an einer Stelle. */
export const EDITABLE_FIELDS = [
  "name",
  "position",
  "diameterMeters",
  "plantedAt",
  "notes",
  "photoUri",
] as const satisfies readonly EditableField[];
