import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Plant, PlantEdits, PlantId } from "../garden/types";

const STORAGE_KEY = "merkbeet/garden/v1";

/**
 * Gespeichert wird nur die Abweichung von `GARDEN_PLAN`, nicht der ganze
 * Garten. Dadurch wirken spaetere Korrekturen an den Skizzendaten im Code auch
 * auf Geraeten, auf denen schon gespeichert wurde, und trotzdem bleiben eigene
 * Aenderungen erhalten.
 */
export type PersistedGarden = {
  version: 1;
  edits: Record<PlantId, PlantEdits>;
  added: Plant[];
  removed: PlantId[];
};

export const EMPTY_GARDEN: PersistedGarden = { version: 1, edits: {}, added: [], removed: [] };

const isPersisted = (value: unknown): value is PersistedGarden =>
  typeof value === "object" && value !== null && (value as PersistedGarden).version === 1;

export const loadGarden = async (): Promise<PersistedGarden> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_GARDEN;
    const parsed: unknown = JSON.parse(raw);
    return isPersisted(parsed) ? parsed : EMPTY_GARDEN;
  } catch {
    // Ein defekter Speicher darf die App nicht blockieren; dann startet sie
    // eben mit dem Plan aus der Skizze.
    return EMPTY_GARDEN;
  }
};

export const saveGarden = async (garden: PersistedGarden): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(garden));
};
