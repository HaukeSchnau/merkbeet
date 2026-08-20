import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import type { SpeciesId } from "../garden/species";
import type { Plant, PlantEdits, PlantId, Point } from "../garden/types";
import { isUnchanged, pullGarden, pushGarden, type SyncFailure } from "../sync/client";
import { coalesceChange, resolvePlants } from "../sync/merge";
import type { PlantChange } from "../sync/types";
import {
  EMPTY_GARDEN,
  effectiveRecords,
  forgetPasscode,
  loadGarden,
  loadPasscode,
  saveGarden,
  savePasscode,
  type LocalGarden,
} from "./persistence";

/** Wie oft im Hintergrund nachgefragt wird, solange die App offen ist. */
const POLL_INTERVAL_MS = 20_000;
/** Nach einer Änderung kurz warten, damit Tippen nicht jeden Buchstaben schickt. */
const PUSH_DEBOUNCE_MS = 1_200;
const SAVE_DEBOUNCE_MS = 400;

export type SyncStatus = {
  state: "startup" | "synced" | "syncing" | "offline" | "unauthorized";
  /** Eigene Änderungen, die noch nicht beim Server sind. */
  pendingCount: number;
  /** Zeitpunkt des letzten erfolgreichen Abgleichs. */
  lastSyncedAt: number | null;
};

export type Garden = {
  plants: Plant[];
  /** Vor dem Laden wird nichts gezeichnet, damit keine alten Stände aufblitzen. */
  ready: boolean;
  status: SyncStatus;
  /** `null`, solange noch kein Code eingegeben wurde. */
  passcode: string | null;
  setPasscode: (passcode: string) => void;
  signOut: () => void;
  syncNow: () => void;
  movePlant: (id: PlantId, position: Point) => void;
  editPlant: (id: PlantId, edits: PlantEdits) => void;
  addPlant: (speciesId: SpeciesId, position: Point) => PlantId;
  removePlant: (id: PlantId) => void;
};

const failureState = (failure: SyncFailure): SyncStatus["state"] =>
  failure.kind === "unauthorized" ? "unauthorized" : "offline";

export const useGarden = (): Garden => {
  const [garden, setGarden] = useState<LocalGarden>(EMPTY_GARDEN);
  const [passcode, setPasscodeState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<SyncStatus["state"]>("startup");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  // Der laufende Sync greift auf den aktuellen Stand zu, ohne dass sich die
  // Funktion bei jeder Änderung neu aufbaut.
  const gardenRef = useRef(garden);
  gardenRef.current = garden;
  const passcodeRef = useRef(passcode);
  passcodeRef.current = passcode;
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    void Promise.all([loadGarden(), loadPasscode()]).then(([loaded, code]) => {
      if (!active) return;
      setGarden(loaded);
      setPasscodeState(code);
      setReady(true);
      if (!code) setState("unauthorized");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => void saveGarden(garden), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [garden, ready]);

  /**
   * Ein Abgleich. Liegen eigene Änderungen an, werden sie geschickt; sonst wird
   * nur nachgefragt. Der Server antwortet in beiden Fällen mit dem
   * zusammengeführten Gesamtstand.
   */
  const sync = useCallback(async () => {
    const code = passcodeRef.current;
    if (!code || inFlight.current) return;
    inFlight.current = true;
    setState("syncing");
    try {
      const sent = gardenRef.current.pending;
      const changes = Object.values(sent);

      const result = changes.length > 0 ? await pushGarden(code, changes) : await pullGarden(code, gardenRef.current.revision);
      if (!result.ok) {
        setState(failureState(result.failure));
        return;
      }

      setGarden((previous) => {
        // Was während der Anfrage neu getippt wurde, muss bleiben. Deshalb wird
        // nur entfernt, was unverändert dieselbe Änderung ist, die rausging.
        const pending: Record<PlantId, PlantChange> = {};
        for (const [id, change] of Object.entries(previous.pending)) {
          if (sent[id] !== change) pending[id] = change;
        }
        if (isUnchanged(result.value)) {
          return { ...previous, revision: result.value.revision, pending };
        }
        return { version: 2, revision: result.value.revision, records: result.value.records, pending };
      });
      setLastSyncedAt(Date.now());
      setState("synced");
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Beim Start, beim Zurückkehren in den Vordergrund und regelmäßig.
  useEffect(() => {
    if (!ready || !passcode) return;
    void sync();
    const timer = setInterval(() => void sync(), POLL_INTERVAL_MS);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void sync();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [ready, passcode, sync]);

  // Eigene Änderungen zügig loswerden, aber nicht bei jedem Tastendruck.
  const pendingCount = Object.keys(garden.pending).length;
  useEffect(() => {
    if (!ready || !passcode || pendingCount === 0) return;
    const timer = setTimeout(() => void sync(), PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [pendingCount, garden.pending, ready, passcode, sync]);

  const queue = useCallback((change: PlantChange) => {
    setGarden((previous) => ({
      ...previous,
      pending: { ...previous.pending, [change.id]: coalesceChange(previous.pending[change.id], change) },
    }));
  }, []);

  const editPlant = useCallback(
    (id: PlantId, edits: PlantEdits) => {
      // `undefined` heißt in der App "Feld leeren"; im Sync-Format ist das null.
      const fields: PlantChange["fields"] = {};
      for (const [field, value] of Object.entries(edits)) {
        fields[field as keyof PlantEdits] = value ?? null;
      }
      queue({ id, fields });
    },
    [queue],
  );

  const movePlant = useCallback((id: PlantId, position: Point) => queue({ id, fields: { position } }), [queue]);

  const addPlant = useCallback(
    (speciesId: SpeciesId, position: Point): PlantId => {
      // Zufall im Namen, damit zwei Geräte offline nicht dieselbe id vergeben.
      const id = `${speciesId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      queue({ id, speciesId, fields: { position } });
      return id;
    },
    [queue],
  );

  const removePlant = useCallback((id: PlantId) => queue({ id, removed: true }), [queue]);

  const setPasscode = useCallback(
    (next: string) => {
      setPasscodeState(next);
      setState("startup");
      void savePasscode(next);
    },
    [],
  );

  const signOut = useCallback(() => {
    setPasscodeState(null);
    setState("unauthorized");
    void forgetPasscode();
  }, []);

  const plants = useMemo(() => resolvePlants(effectiveRecords(garden)), [garden]);

  return {
    plants,
    ready,
    status: { state, pendingCount, lastSyncedAt },
    passcode,
    setPasscode,
    signOut,
    syncNow: () => void sync(),
    movePlant,
    editPlant,
    addPlant,
    removePlant,
  };
};
