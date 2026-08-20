import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { SPECIES, SPECIES_IDS, type SpeciesId } from "../garden/species";
import { colors, radii, spacing } from "./theme";

export type SpeciesPickerProps = {
  visible: boolean;
  onPick: (id: SpeciesId) => void;
  onCancel: () => void;
};

/** Farbtupfer als Vorschau -- dieselbe Palette, die der Plan verwendet. */
const swatchColor = (id: SpeciesId): string => {
  const { art } = SPECIES[id];
  return art.kind === "procedural" ? (art.palette.bloom ?? art.palette.leafMid) : colors.surfaceMuted;
};

export const SpeciesPicker = ({ visible, onPick, onCancel }: SpeciesPickerProps) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
    <Pressable style={styles.backdrop} onPress={onCancel} />
    <View style={styles.sheet}>
      <Text style={styles.title}>Was wurde gepflanzt?</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {SPECIES_IDS.map((id) => (
          <Pressable key={id} style={styles.item} onPress={() => onPick(id)}>
            <View style={[styles.swatch, { backgroundColor: swatchColor(id) }]} />
            <View style={styles.itemText}>
              <Text style={styles.itemName}>{SPECIES[id].name}</Text>
              {SPECIES[id].botanical ? (
                <Text style={styles.itemBotanical}>{SPECIES[id].botanical}</Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable style={styles.cancel} onPress={onCancel}>
        <Text style={styles.cancelText}>Abbrechen</Text>
      </Pressable>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(28, 24, 18, 0.35)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: "78%",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  swatch: { width: 34, height: 34, borderRadius: radii.pill },
  itemText: { flex: 1 },
  itemName: { fontSize: 17, fontWeight: "600", color: colors.text },
  itemBotanical: { fontSize: 13, fontStyle: "italic", color: colors.textMuted },
  cancel: { alignItems: "center", paddingTop: spacing.md },
  cancelText: { fontSize: 16, fontWeight: "700", color: colors.accent },
});
