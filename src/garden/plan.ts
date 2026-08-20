import type { GardenPlan, Plant } from "./types";

/**
 * Der digitalisierte Garten der Eltern.
 *
 * Quelle ist die Handskizze in `docs/reference/garden-sketch.jpg`. Von den vier
 * dort notierten Massen sind drei direkt uebernommen:
 *
 *   19,50 m  Gesamtlaenge des Beetes (West nach Ost)
 *    7,60 m  Laenge des Westarms (Nord nach Sued)
 *    2,50 m  Breite des Westarms
 *    2,30 m  Tiefe des Suedarms
 *
 * Daraus folgt die Terrassentiefe 7,60 - 2,30 = 5,30 m. Alles Uebrige ist aus
 * den Proportionen der Skizze geschaetzt und in `docs/garden-model.md`
 * einzeln als Annahme vermerkt.
 *
 * Ursprung (0,0) ist die Nordwestecke des Beetes. Norden ist oben.
 */

const BED_LENGTH = 19.5;
const BED_WEST_ARM_WIDTH = 2.5;
const BED_WEST_ARM_LENGTH = 7.6;
const BED_SOUTH_ARM_DEPTH = 2.3;

const TERRACE_DEPTH = BED_WEST_ARM_LENGTH - BED_SOUTH_ARM_DEPTH; // 5,30
const TERRACE_WIDTH = 8.2; // geschaetzt aus der Skizze
const HOUSE_VISIBLE_DEPTH = 3.5; // das Haus ist nur angeschnitten dargestellt

/** Die Pflanzen, wie sie am 14.05.2026 in der Skizze eingezeichnet waren. */
const SEED_PLANTS: Plant[] = [
  // Westarm, von Nord nach Sued
  { id: "rose-w1", speciesId: "rose", position: { x: 0.99, y: 1.16 }, diameterMeters: 0.9 },
  { id: "lavender-w1", speciesId: "lavender", position: { x: 1.92, y: 1.49 }, diameterMeters: 0.6 },
  { id: "rose-w2", speciesId: "rose", position: { x: 1.92, y: 2.76 }, diameterMeters: 0.9 },
  { id: "grass-w1", speciesId: "grass", position: { x: 2.07, y: 3.68 }, diameterMeters: 0.8 },
  { id: "buddleia-w1", speciesId: "buddleia", position: { x: 1.1, y: 4.06 }, diameterMeters: 1.8 },
  { id: "viburnum-w1", speciesId: "viburnum", position: { x: 2.03, y: 4.87 }, diameterMeters: 1.0 },
  { id: "magnolia-c1", speciesId: "magnolia", position: { x: 1.97, y: 6.31 }, diameterMeters: 2.2 },
  // Suedarm, von West nach Ost
  { id: "hydrangea-s1", speciesId: "hydrangea", position: { x: 4.19, y: 5.91 }, diameterMeters: 1.1 },
  { id: "spiraea-s1", speciesId: "spiraea", position: { x: 3.71, y: 7.03 }, diameterMeters: 1.0 },
  { id: "rose-s1", speciesId: "rose", position: { x: 4.77, y: 7.07 }, diameterMeters: 0.9 },
  { id: "buddleia-s1", speciesId: "buddleia", position: { x: 6.26, y: 5.73 }, diameterMeters: 1.2 },
  { id: "photinia-s1", speciesId: "photinia", position: { x: 5.87, y: 6.49 }, diameterMeters: 1.3 },
  { id: "lavender-s1", speciesId: "lavender", position: { x: 5.83, y: 7.41 }, diameterMeters: 0.6 },
  { id: "rose-s2", speciesId: "rose", position: { x: 6.93, y: 7.09 }, diameterMeters: 0.9 },
  { id: "hydrangea-s2", speciesId: "hydrangea", position: { x: 7.56, y: 6.12 }, diameterMeters: 1.1 },
  { id: "spiraea-s2", speciesId: "spiraea", position: { x: 8.4, y: 7.28 }, diameterMeters: 1.0 },
  { id: "kilimanjaro-s1", speciesId: "kilimanjaro", position: { x: 9.35, y: 6.66 }, diameterMeters: 2.0 },
  { id: "laurel-s1", speciesId: "laurel", position: { x: 11.01, y: 6.03 }, diameterMeters: 1.3 },
  { id: "lavender-s2", speciesId: "lavender", position: { x: 10.58, y: 7.39 }, diameterMeters: 0.6 },
  { id: "rose-s3", speciesId: "rose", position: { x: 11.53, y: 7.0 }, diameterMeters: 0.9 },
  { id: "hydrangea-s3", speciesId: "hydrangea", position: { x: 12.74, y: 6.53 }, diameterMeters: 1.1 },
  { id: "spiraea-s3", speciesId: "spiraea", position: { x: 14.25, y: 7.22 }, diameterMeters: 1.0 },
  { id: "rose-s4", speciesId: "rose", position: { x: 15.81, y: 6.27 }, diameterMeters: 0.9 },
  { id: "photinia-s2", speciesId: "photinia", position: { x: 17.64, y: 6.01 }, diameterMeters: 1.3 },
  { id: "hydrangea-s4", speciesId: "hydrangea", position: { x: 18.72, y: 6.18 }, diameterMeters: 1.1 },
];

export const GARDEN_PLAN: GardenPlan = {
  bounds: {
    x: -1.8,
    y: -HOUSE_VISIBLE_DEPTH,
    width: BED_LENGTH + 3.6,
    height: HOUSE_VISIBLE_DEPTH + BED_WEST_ARM_LENGTH + 2.6,
  },
  areas: [
    {
      id: "lawn",
      kind: "lawn",
      // Der Rasen liegt als Untergrund unter allem und wird vom Rest ueberdeckt.
      outline: [
        { x: -1.8, y: -HOUSE_VISIBLE_DEPTH },
        { x: BED_LENGTH + 1.8, y: -HOUSE_VISIBLE_DEPTH },
        { x: BED_LENGTH + 1.8, y: BED_WEST_ARM_LENGTH + 2.6 },
        { x: -1.8, y: BED_WEST_ARM_LENGTH + 2.6 },
      ],
    },
    {
      id: "house",
      kind: "house",
      outline: [
        { x: BED_WEST_ARM_WIDTH, y: -HOUSE_VISIBLE_DEPTH },
        { x: BED_LENGTH, y: -HOUSE_VISIBLE_DEPTH },
        { x: BED_LENGTH, y: TERRACE_DEPTH },
        { x: BED_WEST_ARM_WIDTH + TERRACE_WIDTH, y: TERRACE_DEPTH },
        { x: BED_WEST_ARM_WIDTH + TERRACE_WIDTH, y: 0 },
        { x: BED_WEST_ARM_WIDTH, y: 0 },
      ],
    },
    {
      id: "terrace",
      kind: "terrace",
      outline: [
        { x: BED_WEST_ARM_WIDTH, y: 0 },
        { x: BED_WEST_ARM_WIDTH + TERRACE_WIDTH, y: 0 },
        { x: BED_WEST_ARM_WIDTH + TERRACE_WIDTH, y: TERRACE_DEPTH },
        { x: BED_WEST_ARM_WIDTH, y: TERRACE_DEPTH },
      ],
    },
    {
      id: "bed",
      kind: "bed",
      // L-Form: Westarm neben der Terrasse, Suedarm entlang von Terrasse und Haus.
      outline: [
        { x: 0, y: 0 },
        { x: BED_WEST_ARM_WIDTH, y: 0 },
        { x: BED_WEST_ARM_WIDTH, y: TERRACE_DEPTH },
        { x: BED_LENGTH, y: TERRACE_DEPTH },
        { x: BED_LENGTH, y: BED_WEST_ARM_LENGTH },
        { x: 0, y: BED_WEST_ARM_LENGTH },
      ],
    },
  ],
  plants: SEED_PLANTS,
};

/** Wo die Wand von Haus und Terrasse an das Beet stoesst -- fuer den Schlagschatten. */
export const SOUTH_WALL_Y = TERRACE_DEPTH;
export const WEST_WALL_X = BED_WEST_ARM_WIDTH;
