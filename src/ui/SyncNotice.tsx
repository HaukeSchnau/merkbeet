import { Button, Host } from "@expo/ui";
import { StyleSheet, Text, View } from "react-native";

import type { SyncStatus } from "../state/useGarden";
import { colors, radii, spacing } from "./theme";

/**
 * Meldet den Sync-Zustand -- aber nur, wenn es etwas zu melden gibt.
 *
 * Dass es funktioniert, ist der Normalfall und braucht keine Anzeige. Und weil
 * die Meldung kommt und geht, darf sie **keinen Platz im Layout beanspruchen**:
 * als Leiste im Fluss hat sie bei jedem Auftauchen den ganzen Plan verschoben.
 * Sie schwebt deshalb über dem Plan; der Rahmen lässt Berührungen durch, nur
 * die Pille selbst fängt sie ab.
 */
const beschreibe = (status: SyncStatus): { text: string; erneut: boolean } | null => {
  if (status.state === "unauthorized") return { text: "Zugangscode nötig", erneut: false };
  if (status.state === "offline") {
    return {
      text:
        status.pendingCount > 0
          ? `Offline · ${status.pendingCount} nicht gesendet`
          : "Offline",
      erneut: true,
    };
  }
  if (status.state === "startup") return null;
  return status.pendingCount > 0 ? { text: "Wird gesendet …", erneut: false } : null;
};

export type SyncNoticeProps = {
  status: SyncStatus;
  onRetry: () => void;
};

export const SyncNotice = ({ status, onRetry }: SyncNoticeProps) => {
  const meldung = beschreibe(status);
  if (!meldung) return null;

  return (
    <View style={styles.schweber} pointerEvents="box-none">
      <View style={styles.pille}>
        <Text style={styles.text}>{meldung.text}</Text>
        {meldung.erneut ? (
          <Host seedColor={colors.accent} matchContents>
            <Button variant="text" label="Erneut" onPress={onRetry} />
          </Host>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  schweber: {
    position: "absolute",
    top: spacing.sm,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pille: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    // Etwas abheben, damit die Pille auf dem Rasen nicht verschwimmt.
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { fontSize: 14, color: colors.text },
});
