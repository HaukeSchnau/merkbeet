import { Button, Host } from "@expo/ui";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "./theme";

export type EditBarProps = {
  /** Wartet gerade auf den Tipp an die Stelle, an der gepflanzt wird. */
  placing: boolean;
  onAdd: () => void;
  onCancel: () => void;
};

/**
 * Die Leiste im Bearbeiten-Modus.
 *
 * Sie sitzt am unteren Rand, deshalb braucht sie den unteren Sicherheitsabstand
 * selbst -- die SafeAreaView darüber lässt ihn aus, damit der Plan bis an den
 * Rand laufen kann. Ohne den saß die Leiste auf dem Home-Indikator.
 */
export const EditBar = ({ placing, onAdd, onCancel }: EditBarProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {/* Der Fließtext bleibt im RN-Layout, damit er schrumpfen kann;
          matchContents würde den Host über den Rand hinaus bemessen. */}
      {/* Kurz genug für eine Zeile: zwei Zeilen machten die Leiste hoch und
          unruhig, und mehr als den Hinweis braucht es hier nicht. */}
      <Text style={styles.hinweis} numberOfLines={1}>
        {placing ? "Tippe auf die Stelle im Plan." : "Zum Verschieben ziehen."}
      </Text>
      <Host seedColor={colors.accent} matchContents>
        {placing ? (
          <Button variant="text" label="Abbrechen" onPress={onCancel} />
        ) : (
          <Button variant="filled" label="+ Pflanze" onPress={onAdd} />
        )}
      </Host>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.accentSoft,
    // Eine Kante nach oben trennt die Leiste sauber vom Plan.
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hinweis: { flex: 1, fontSize: 14, lineHeight: 19, color: colors.text },
});
