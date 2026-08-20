import type { SpeciesId } from "./species";

/**
 * Alle Koordinaten und Groessen sind echte Meter. Der Ursprung liegt in der
 * Nordwestecke des Beetes; x zeigt nach Osten, y nach Sueden. Damit bleiben
 * Beetgeometrie und Pflanzenpositionen unabhaengig von der Bildschirmgroesse.
 */
export type Point = { x: number; y: number };

export type Rect = { x: number; y: number; width: number; height: number };

export type AreaKind = "lawn" | "house" | "terrace" | "bed";

export type GardenArea = {
  id: string;
  kind: AreaKind;
  /** Geschlossener Umriss im Uhrzeigersinn (Nordwesten zuerst). */
  outline: Point[];
};

export type PlantId = string;

export type Plant = {
  id: PlantId;
  speciesId: SpeciesId;
  position: Point;
  /** Kronendurchmesser; ohne Angabe gilt der Standardwert der Art. */
  diameterMeters?: number;
  /** Ueberschreibt den Artnamen, z.B. fuer eine benannte Sorte. */
  name?: string;
  /** ISO-Datum (YYYY-MM-DD). */
  plantedAt?: string;
  notes?: string;
  photoUri?: string;
};

/** Die Felder, die in der App geaendert werden koennen. */
export type PlantEdits = Partial<
  Pick<Plant, "name" | "position" | "diameterMeters" | "plantedAt" | "notes" | "photoUri">
>;

export type GardenPlan = {
  /** Sichtbarer Weltausschnitt in Metern. */
  bounds: Rect;
  areas: GardenArea[];
  plants: Plant[];
};
