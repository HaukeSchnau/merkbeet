import { z } from "zod";

import { SPECIES, type SpeciesId } from "../src/garden/species";

/**
 * Der Endpunkt ist öffentlich erreichbar, deshalb wird jede Anfrage gegen ein
 * Schema geprüft, bevor sie den Merge sieht.
 */

const point = z.object({ x: z.number().finite(), y: z.number().finite() });

/** Unbekannte Arten werden abgewiesen -- der Renderer könnte sie nicht zeichnen. */
const speciesId = z.string().refine((value): value is SpeciesId => value in SPECIES, {
  message: "unbekannte Art",
});

const text = (max: number) => z.union([z.string().max(max), z.null()]);

const plantId = z
  .string()
  .min(1)
  .max(120)
  // Ids landen in Dateinamen und URLs; nichts Exotisches zulassen.
  .regex(/^[a-zA-Z0-9._-]+$/);

export const plantChangeSchema = z.object({
  id: plantId,
  speciesId: speciesId.optional(),
  fields: z
    .object({
      name: text(120).optional(),
      position: z.union([point, z.null()]).optional(),
      diameterMeters: z.union([z.number().finite().min(0.05).max(30), z.null()]).optional(),
      plantedAt: text(40).optional(),
      notes: text(4000).optional(),
      photoUri: text(400).optional(),
    })
    .optional(),
  removed: z.boolean().optional(),
});

export const pushRequestSchema = z.object({
  changes: z.array(plantChangeSchema).max(500),
});
