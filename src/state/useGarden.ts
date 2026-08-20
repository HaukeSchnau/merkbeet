import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GARDEN_PLAN } from "../garden/plan";
import type { SpeciesId } from "../garden/species";
import type { Plant, PlantEdits, PlantId, Point } from "../garden/types";
import { EMPTY_GARDEN, loadGarden, saveGarden, type PersistedGarden } from "./persistence";

const SAVE_DEBOUNCE_MS = 400;

/** Legt die gespeicherten Aenderungen ueber den Plan aus der Skizze. */
const resolvePlants = (garden: PersistedGarden): Plant[] => {
  const removed = new Set(garden.removed);
  return [...GARDEN_PLAN.plants, ...garden.added]
    .filter((plant) => !removed.has(plant.id))
    .map((plant) => ({ ...plant, ...garden.edits[plant.id] }));
};

export type Garden = {
  plants: Plant[];
  /** Vor dem Laden wird nichts gerendert, damit keine alten Positionen aufblitzen. */
  ready: boolean;
  movePlant: (id: PlantId, position: Point) => void;
  editPlant: (id: PlantId, edits: PlantEdits) => void;
  addPlant: (speciesId: SpeciesId, position: Point) => PlantId;
  removePlant: (id: PlantId) => void;
};

export const useGarden = (): Garden => {
  const [garden, setGarden] = useState<PersistedGarden>(EMPTY_GARDEN);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    loadGarden().then((loaded) => {
      if (!active) return;
      setGarden(loaded);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveGarden(garden);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [garden, ready]);

  const editPlant = useCallback((id: PlantId, edits: PlantEdits) => {
    setGarden((previous) => ({
      ...previous,
      edits: { ...previous.edits, [id]: { ...previous.edits[id], ...edits } },
    }));
  }, []);

  const movePlant = useCallback(
    (id: PlantId, position: Point) => {
      editPlant(id, { position });
    },
    [editPlant],
  );

  const addPlant = useCallback((speciesId: SpeciesId, position: Point): PlantId => {
    const id = `${speciesId}-${Date.now().toString(36)}`;
    setGarden((previous) => ({
      ...previous,
      added: [...previous.added, { id, speciesId, position }],
    }));
    return id;
  }, []);

  const removePlant = useCallback((id: PlantId) => {
    setGarden((previous) => {
      const { [id]: _dropped, ...edits } = previous.edits;
      return {
        ...previous,
        edits,
        added: previous.added.filter((plant) => plant.id !== id),
        // Nur Pflanzen aus der Skizze brauchen einen Grabstein; selbst
        // hinzugefuegte sind mit dem Entfernen aus `added` weg.
        removed: GARDEN_PLAN.plants.some((plant) => plant.id === id)
          ? [...previous.removed, id]
          : previous.removed,
      };
    });
  }, []);

  const plants = useMemo(() => resolvePlants(garden), [garden]);

  return { plants, ready, movePlant, editPlant, addPlant, removePlant };
};
