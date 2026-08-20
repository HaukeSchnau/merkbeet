import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import type { SyncStatus } from "../state/useGarden";
import { colors, radii, spacing } from "./theme";

/**
 * Der Sync-Zustand in Worten. Für die Eltern zählt nur eine Frage: ist mein
 * Stand bei den anderen angekommen? Deshalb keine Symbole, sondern Text -- und
 * offene Änderungen werden gezählt, damit man sieht, dass nichts verloren ist.
 */
const describe = (status: SyncStatus): { text: string; tone: "gut" | "warten" | "problem" } => {
  if (status.state === "unauthorized") return { text: "Code nötig", tone: "problem" };
  if (status.state === "offline") {
    return status.pendingCount > 0
      ? { text: `Offline · ${status.pendingCount} warten`, tone: "warten" }
      : { text: "Offline", tone: "warten" };
  }
  if (status.state === "syncing") return { text: "Gleicht ab …", tone: "warten" };
  if (status.state === "startup") return { text: "Lädt …", tone: "warten" };
  return status.pendingCount > 0
    ? { text: `${status.pendingCount} werden gesendet`, tone: "warten" }
    : { text: "Aktuell", tone: "gut" };
};

export type SyncBadgeProps = {
  status: SyncStatus;
  onPress: () => void;
};

export const SyncBadge = ({ status, onPress }: SyncBadgeProps) => {
  const { text, tone } = describe(status);
  const busy = status.state === "syncing" || status.state === "startup";

  return (
    <Pressable style={styles.badge} onPress={onPress} accessibilityLabel={`Sync-Status: ${text}`}>
      {busy ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : (
        <View style={[styles.dot, styles[tone]]} />
      )}
      <Text style={styles.text}>{text}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
  },
  dot: { width: 8, height: 8, borderRadius: radii.pill },
  gut: { backgroundColor: "#4f8a57" },
  warten: { backgroundColor: "#c9922f" },
  problem: { backgroundColor: colors.danger },
  text: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
});
