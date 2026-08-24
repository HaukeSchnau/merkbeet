import { Button, Host } from "@expo/ui";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import type { SpeciesId } from "./src/garden/species";
import type { Point } from "./src/garden/types";
import { useGarden } from "./src/state/useGarden";
import { DiagnosticsScreen } from "./src/ui/DiagnosticsScreen";
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
 * grenzt damit ein, welche Schicht klemmt.
 */
const diagnoseGewuenscht = (): boolean => {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("diag");
};

export default function App() {
  const garden = useGarden();
  const [editMode, setEditMode] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Ist eine Art gewaehlt, wartet die App auf den Tipp an die Zielstelle.
  const [pendingSpecies, setPendingSpecies] = useState<SpeciesId | null>(null);

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

  if (diagnoseGewuenscht()) {
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
          />
          <SyncNotice status={garden.status} onRetry={garden.syncNow} />

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

          {editMode ? (
            <View style={styles.editBar}>
              {/* Der Fließtext bleibt im RN-Layout, damit er schrumpfen kann;
                  matchContents würde den Host über den Rand hinaus bemessen. */}
              <Text style={styles.editHint}>
                {pendingSpecies
                  ? "Tippe auf die Stelle im Plan."
                  : "Pflanzen lassen sich jetzt verschieben."}
              </Text>
              <Host seedColor={colors.accent} matchContents>
                {pendingSpecies ? (
                  <Button variant="text" label="Abbrechen" onPress={() => setPendingSpecies(null)} />
                ) : (
                  <Button variant="filled" label="+ Pflanze" onPress={() => setPickerOpen(true)} />
                )}
              </Host>
            </View>
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  editHint: { flex: 1, fontSize: 14, color: colors.text },
  editBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.accentSoft,
  },

});
