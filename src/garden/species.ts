/**
 * Artenkatalog: pro Pflanzenart der Anzeigename und die Anweisung, wie sie
 * auf dem Plan gezeichnet wird.
 *
 * `art` ist bewusst eine Union: solange es keine gezeichneten Assets gibt,
 * wird jede Art prozedural aus Form + Palette gerendert. Sobald ein Bild
 * vorliegt, wird nur dieser eine Eintrag auf `{ kind: "asset", ... }`
 * umgestellt -- der Renderer und die Daten bleiben unveraendert.
 */

/** Grundform der Blattmasse von oben gesehen. */
export type PlantForm =
  | "mound" // dichter, runder Strauch
  | "canopy" // groesseres Gehoelz mit lockerer Krone
  | "grass" // radial auseinanderfallende Halme
  | "tuft"; // niedriger, silbriger Polster

/** Wie die Blueten aussehen (falls die Art blueht). */
export type BloomStyle =
  | "none"
  | "cluster" // Ballblueten, z.B. Hortensie, Schneeball
  | "spike" // Bluetenrispen, z.B. Sommerflieder, Lavendel
  | "rosette" // einzelne gefuellte Blueten, z.B. Rose
  | "umbel" // flache Bluetendolden, z.B. Spiere
  | "star"; // sternfoermige Einzelblueten, z.B. Sternmagnolie

export type PlantPalette = {
  /** Aeusserster Blattkranz. Ohne Angabe wird `leafDark` verwendet. */
  leafTip?: string;
  leafDark: string;
  leafMid: string;
  leafLight: string;
  bloom?: string;
  bloomCore?: string;
};

export type SpeciesArt =
  | { kind: "procedural"; form: PlantForm; bloom: BloomStyle; palette: PlantPalette }
  | {
      kind: "asset";
      /** Ergebnis eines `require("...png")`. */
      source: number;
      /**
       * Wie viel des Bildes die Pflanze ausfuellt. 1 = Bildkante entspricht
       * dem Kronendurchmesser, 1.2 = das Bild hat 20 % Luft am Rand.
       */
      footprintScale?: number;
    };

export type Species = {
  name: string;
  botanical?: string;
  /** Kronendurchmesser in Metern, wenn eine Pflanze keinen eigenen Wert hat. */
  defaultDiameterMeters: number;
  art: SpeciesArt;
};

/**
 * Haelt die Schluessel als Literale fest (fuer `SpeciesId`), waehrend die Werte
 * auf `Species` verbreitert werden -- sonst waeren optionale Felder wie
 * `botanical` an den Eintraegen, die sie nicht setzen, nicht mehr zugreifbar.
 */
const defineCatalog = <T extends Record<string, Species>>(catalog: T): { [K in keyof T]: Species } =>
  catalog;

export const SPECIES = defineCatalog({
  rose: {
    name: "Rose",
    botanical: "Rosa",
    defaultDiameterMeters: 0.9,
    art: {
      kind: "procedural",
      form: "mound",
      bloom: "rosette",
      palette: {
        leafDark: "#2f5d3a",
        leafMid: "#3d7248",
        leafLight: "#4f8a57",
        bloom: "#d9607a",
        bloomCore: "#f4b3c0",
      },
    },
  },
  lavender: {
    name: "Lavendel",
    botanical: "Lavandula angustifolia",
    defaultDiameterMeters: 0.6,
    art: {
      kind: "procedural",
      form: "tuft",
      bloom: "spike",
      palette: {
        leafDark: "#7e9179",
        leafMid: "#93a688",
        leafLight: "#aebfa1",
        bloom: "#7c6bb0",
        bloomCore: "#a293ce",
      },
    },
  },
  hydrangea: {
    name: "Hortensie",
    botanical: "Hydrangea",
    defaultDiameterMeters: 1.1,
    art: {
      kind: "procedural",
      form: "mound",
      bloom: "cluster",
      palette: {
        leafDark: "#35663f",
        leafMid: "#43794c",
        leafLight: "#58915d",
        bloom: "#7fa8d9",
        bloomCore: "#d3e2f4",
      },
    },
  },
  kilimanjaro: {
    name: "Kilimandscharo",
    botanical: "Hydrangea paniculata",
    defaultDiameterMeters: 2.0,
    art: {
      kind: "procedural",
      form: "mound",
      bloom: "cluster",
      palette: {
        leafDark: "#3b6b43",
        leafMid: "#4a7d4f",
        leafLight: "#5c9159",
        bloom: "#f7f4ea",
        bloomCore: "#e8ddc6",
      },
    },
  },
  spiraea: {
    name: "Spiere",
    botanical: "Spiraea",
    defaultDiameterMeters: 1.0,
    art: {
      kind: "procedural",
      form: "mound",
      bloom: "umbel",
      palette: {
        leafDark: "#46733a",
        leafMid: "#578a46",
        leafLight: "#6ba055",
        bloom: "#d98aa8",
        bloomCore: "#efc3d4",
      },
    },
  },
  buddleia: {
    name: "Sommerflieder",
    botanical: "Buddleja davidii",
    defaultDiameterMeters: 1.6,
    art: {
      kind: "procedural",
      form: "mound",
      bloom: "spike",
      palette: {
        leafDark: "#4a6b4a",
        leafMid: "#5c8058",
        leafLight: "#719767",
        bloom: "#8c5fa8",
        bloomCore: "#b48fc9",
      },
    },
  },
  viburnum: {
    name: "Schneeball",
    botanical: "Viburnum",
    defaultDiameterMeters: 1.0,
    art: {
      kind: "procedural",
      form: "mound",
      bloom: "cluster",
      palette: {
        leafDark: "#2e5c3c",
        leafMid: "#3c724a",
        leafLight: "#4d8a58",
        bloom: "#f4f5ec",
        bloomCore: "#dfe3d1",
      },
    },
  },
  magnolia: {
    name: "Sternmagnolie",
    botanical: "Magnolia stellata",
    defaultDiameterMeters: 2.2,
    art: {
      kind: "procedural",
      form: "canopy",
      bloom: "star",
      palette: {
        leafDark: "#3a6b45",
        leafMid: "#4b8054",
        leafLight: "#61996a",
        bloom: "#fbf7f2",
        bloomCore: "#f0dfc8",
      },
    },
  },
  photinia: {
    name: "Glanzmispel",
    botanical: "Photinia fraseri 'Red Robin'",
    defaultDiameterMeters: 1.3,
    art: {
      kind: "procedural",
      form: "mound",
      bloom: "none",
      palette: {
        leafTip: "#b8463a",
        leafDark: "#2f5138",
        leafMid: "#3d6644",
        leafLight: "#4e7d51",
      },
    },
  },
  laurel: {
    name: "Portugiesischer Lorbeer",
    botanical: "Prunus lusitanica",
    defaultDiameterMeters: 1.3,
    art: {
      kind: "procedural",
      form: "mound",
      bloom: "none",
      palette: {
        leafDark: "#24462f",
        leafMid: "#315a3a",
        leafLight: "#416f47",
      },
    },
  },
  grass: {
    name: "Ziergras",
    defaultDiameterMeters: 0.8,
    art: {
      kind: "procedural",
      form: "grass",
      bloom: "none",
      palette: {
        leafDark: "#7d904f",
        leafMid: "#98ab63",
        leafLight: "#b6c583",
      },
    },
  },
});

export type SpeciesId = keyof typeof SPECIES;

export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];

export const speciesOf = (id: SpeciesId): Species => SPECIES[id];
