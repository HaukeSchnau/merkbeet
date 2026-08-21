import { Button, Host } from "@expo/ui";
import { StyleSheet, Text, View } from "react-native";

import type { SyncStatus } from "../state/useGarden";
import { colors, spacing } from "./theme";

/**
 * Meldet den Sync-Zustand -- aber nur, wenn es etwas zu melden gibt.
 *
 * Vorher stand dauerhaft "Aktuell" in der Kopfzeile. Das ist die Information,
 * die niemanden interessiert: dass es funktioniert, ist der Normalfall. Jetzt
 * erscheint hier nur etwas, wenn Änderungen warten, die Verbindung fehlt oder
 * der Code gebraucht wird.
 */
const describe = (status: SyncStatus): string | null => {
  if (status.state === "unauthorized") return "Zugangscode nötig";
  if (status.state === "offline") {
    return status.pendingCount > 0
      ? `Offline — ${status.pendingCount} Änderung${status.pendingCount === 1 ? "" : "en"} warten`
      : "Offline";
  }
  if (status.state === "startup") return null;
  return status.pendingCount > 0 ? "Wird gesendet …" : null;
};

export type SyncNoticeProps = {
  status: SyncStatus;
  onRetry: () => void;
};

export const SyncNotice = ({ status, onRetry }: SyncNoticeProps) => {
  const text = describe(status);
  if (!text) return null;
  const retryable = status.state === "offline";

  return (
    <View style={styles.bar}>
      {/* Der Fließtext bleibt im RN-Layout, damit er schrumpfen kann. */}
      <Text style={styles.text}>{text}</Text>
      {retryable ? (
        <Host seedColor={colors.accent} matchContents>
          <Button variant="text" label="Erneut" onPress={onRetry} />
        </Host>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  text: { flex: 1, fontSize: 14, color: colors.text },
});
