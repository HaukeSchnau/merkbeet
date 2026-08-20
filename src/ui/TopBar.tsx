import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SyncStatus } from "../state/useGarden";
import { SyncBadge } from "./SyncBadge";
import { colors, radii, spacing } from "./theme";

export type TopBarProps = {
  editMode: boolean;
  showLabels: boolean;
  status: SyncStatus;
  onToggleEdit: () => void;
  onToggleLabels: () => void;
  onSyncNow: () => void;
};

const Chip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

export const TopBar = ({
  editMode,
  showLabels,
  status,
  onToggleEdit,
  onToggleLabels,
  onSyncNow,
}: TopBarProps) => (
  <View style={styles.bar}>
    <View style={styles.identity}>
      <Text style={styles.title}>Merkbeet</Text>
      <SyncBadge status={status} onPress={onSyncNow} />
    </View>
    <View style={styles.actions}>
      <Chip label="Etiketten" active={showLabels} onPress={onToggleLabels} />
      <Chip label={editMode ? "Fertig" : "Bearbeiten"} active={editMode} onPress={onToggleEdit} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  identity: { gap: spacing.xs, alignItems: "flex-start" },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: 0.2 },
  actions: { flexDirection: "row", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: colors.surface },
});
