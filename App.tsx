import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import type { SpeciesId } from "./src/garden/species";
import type { Point } from "./src/garden/types";
import { useGarden } from "./src/state/useGarden";
import { PasscodeScreen } from "./src/ui/PasscodeScreen";
import { PlantSheet } from "./src/ui/PlantSheet";
import { SpeciesPicker } from "./src/ui/SpeciesPicker";
import { colors, radii, spacing } from "./src/ui/theme";
import { TopBar } from "./src/ui/TopBar";
import { GardenCanvas } from "./src/view/GardenCanvas";

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
            status={garden.status}
            onToggleEdit={toggleEdit}
            onToggleLabels={() => setShowLabels((previous) => !previous)}
            onSyncNow={garden.syncNow}
          />

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
              {pendingSpecies ? (
                <>
                  <Text style={styles.editHint}>Tippe auf die Stelle im Plan.</Text>
                  <Pressable style={styles.editButton} onPress={() => setPendingSpecies(null)}>
                    <Text style={styles.editButtonText}>Abbrechen</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.editHint}>Pflanzen lassen sich jetzt verschieben.</Text>
                  <Pressable style={styles.editButton} onPress={() => setPickerOpen(true)}>
                    <Text style={styles.editButtonText}>+ Pflanze</Text>
                  </Pressable>
                </>
              )}
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
  editBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.accentSoft,
  },
  editHint: { flex: 1, fontSize: 14, color: colors.text },
  editButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  editButtonText: { fontSize: 15, fontWeight: "700", color: colors.surface },
});
