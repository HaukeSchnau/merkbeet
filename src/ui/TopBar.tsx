import { Button, Host, Row, Switch } from "@expo/ui";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "./theme";

export type TopBarProps = {
  editMode: boolean;
  showLabels: boolean;
  onToggleEdit: () => void;
  onToggleLabels: () => void;
  /** Langes Drücken auf den Titel öffnet die Diagnose. */
  onDiagnostics: () => void;
};

/**
 * Kopfzeile mit nativen Bedienelementen: auf Android Jetpack Compose, auf iOS
 * SwiftUI, im Browser ein Nachbau in React Native Web. Der Umschalter für die
 * Etiketten ist ein echter Schalter statt eines nachgebauten Knopfes -- das
 * fühlt sich auf dem Gerät nach System an und nicht nach Website.
 */
export const TopBar = ({
  editMode,
  showLabels,
  onToggleEdit,
  onToggleLabels,
  onDiagnostics,
}: TopBarProps) => (
  <View style={styles.bar}>
    {/*
      Auf dem Gerät gibt es keine Adresszeile, über die man ?diag=1 aufrufen
      könnte. Langes Drücken auf den Titel ist der Ersatz -- versteckt genug,
      dass niemand versehentlich hineinrutscht.
    */}
    <Pressable onLongPress={onDiagnostics} delayLongPress={1200}>
      <Text style={styles.title}>Merkbeet</Text>
    </Pressable>
    <Host seedColor={colors.accent} matchContents>
      <Row spacing={spacing.md} alignment="center">
        <Switch value={showLabels} onValueChange={onToggleLabels} label="Etiketten" />
        <Button
          variant={editMode ? "filled" : "outlined"}
          label={editMode ? "Fertig" : "Bearbeiten"}
          onPress={onToggleEdit}
        />
      </Row>
    </Host>
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
  title: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: 0.2 },
});
