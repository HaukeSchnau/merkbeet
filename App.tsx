import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import type { SpeciesId } from "./src/garden/species";
import type { Point } from "./src/garden/types";
import { useGarden } from "./src/state/useGarden";
import { DiagnosticsScreen } from "./src/ui/DiagnosticsScreen";
import { EditBar } from "./src/ui/EditBar";
import { PasscodeScreen } from "./src/ui/PasscodeScreen";
import { SyncNotice } from "./src/ui/SyncNotice";
import { PlantSheet } from "./src/ui/PlantSheet";
import { SpeciesPicker } from "./src/ui/SpeciesPicker";
import { colors, spacing } from "./src/ui/theme";
import { TopBar } from "./src/ui/TopBar";
import { GardenCanvas } from "./src/view/GardenCanvas";

/**
 * `?diag=1` zeigt statt des Gartens einen Diagnosebildschirm. Für Geräte, an die
 * ich nicht herankomme -- er läuft ohne Skia und ohne native Bedienelemente und
 * grenzt damit ein, welche Schicht klemmt. Auf dem Gerät führt langes Drücken
 * auf den Titel dorthin.
 *
 * Die Plattform wird über `Platform.OS` geprüft, nicht über `typeof window`:
 * React Native definiert `window` durchaus, aber `window.location` nicht --
 * dieser Zugriff hat die App beim Start abgeschossen.
 */
const diagnoseGewuenscht = (): boolean => {
  if (Platform.OS !== "web") return false;
  const suche = globalThis.location?.search;
  return typeof suche === "string" && new URLSearchParams(suche).has("diag");
};

export default function App() {
  const garden = useGarden();
  const [editMode, setEditMode] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Ist eine Art gewaehlt, wartet die App auf den Tipp an die Zielstelle.
  const [pendingSpecies, setPendingSpecies] = useState<SpeciesId | null>(null);
  // Auf dem Gerät über langes Drücken auf den Titel erreichbar, im Browser
  // zusätzlich über ?diag=1.
  const [diagnose, setDiagnose] = useState(false);

  const selected = useMemo(
    () => garden.plants.find((plant) => plant.id === selectedId) ?? null,
    [garden.plants, selectedId],
  );

  const toggleEdit = useCallback(() => {
    setEditMode((previous) => !previous);
    setPendingSpecies(null);
  }, []);

  const place = useCallback(
    (position: Point) => {
      if (!pendingSpecies) return;
      const id = garden.addPlant(pendingSpecies, position);
      setPendingSpecies(null);
      setSelectedId(id);
    },
    [garden, pendingSpecies],
  );

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    garden.removePlant(selectedId);
    setSelectedId(null);
  }, [garden, selectedId]);

  if (diagnose || diagnoseGewuenscht()) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
          <StatusBar style="dark" />
          <DiagnosticsScreen />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (garden.ready && !garden.passcode) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
            <StatusBar style="dark" />
            <PasscodeScreen onAccepted={garden.setPasscode} />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <StatusBar style="dark" />
          <TopBar
            editMode={editMode}
            showLabels={showLabels}
            onToggleEdit={toggleEdit}
            onToggleLabels={() => setShowLabels((previous) => !previous)}
            onDiagnostics={() => setDiagnose(true)}
          />

          {/* Plan und Meldung teilen sich einen Bereich: die Meldung schwebt
              darüber, statt Platz zu beanspruchen und alles zu verschieben. */}
          <View style={styles.planFlaeche}>
            {garden.ready ? (
              <GardenCanvas
                plants={garden.plants}
                showLabels={showLabels}
                editMode={editMode}
                placing={pendingSpecies !== null}
                selectedId={editMode ? selectedId : null}
                onSelect={setSelectedId}
                onMove={garden.movePlant}
                onPlace={place}
              />
            ) : (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.accent} />
              </View>
            )}

            <SyncNotice status={garden.status} onRetry={garden.syncNow} />
          </View>

          {editMode ? (
            <EditBar
              placing={pendingSpecies !== null}
              onAdd={() => setPickerOpen(true)}
              onCancel={() => setPendingSpecies(null)}
            />
          ) : null}

          <PlantSheet
            plant={selected}
            editMode={editMode}
            passcode={garden.passcode}
            onClose={() => setSelectedId(null)}
            onEdit={garden.editPlant}
            onRemove={removeSelected}
          />

          <SpeciesPicker
            visible={pickerOpen}
            onPick={(id) => {
              setPickerOpen(false);
              setSelectedId(null);
              setPendingSpecies(id);
            }}
            onCancel={() => setPickerOpen(false)}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.surface },
  planFlaeche: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },

});
