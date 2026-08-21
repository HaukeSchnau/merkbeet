import { Button, Column, Host, Text, TextInput, useNativeState } from "@expo/ui";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { checkPasscode } from "../sync/client";
import { colors, spacing } from "./theme";

export type PasscodeScreenProps = {
  onAccepted: (passcode: string) => void;
};

/**
 * Der Zugang zum gemeinsamen Gartenstand. Ein Code für die ganze Familie statt
 * eigener Konten: es gibt genau einen Garten, und niemand soll sich ein
 * Passwort merken müssen. Der Code wird auf dem Gerät gespeichert, die Abfrage
 * kommt also nur beim ersten Mal.
 *
 * Eingabefeld und Knopf sind native Bedienelemente -- auf Android die
 * Systemtastatur mit Material-Feld, auf iOS SwiftUI.
 */
export const PasscodeScreen = ({ onAccepted }: PasscodeScreenProps) => {
  const code = useNativeState("");
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = code.value.trim();
    if (trimmed === "" || checking) return;
    setChecking(true);
    setProblem(null);
    const result = await checkPasscode(trimmed);
    setChecking(false);
    if (result.ok) {
      onAccepted(trimmed);
      return;
    }
    setProblem(
      result.failure.kind === "unauthorized"
        ? "Der Code stimmt nicht."
        : "Der Garten ist gerade nicht erreichbar. Später noch einmal versuchen.",
    );
  };

  return (
    <View style={styles.screen}>
      <Host seedColor={colors.accent} matchContents>
        <Column spacing={spacing.lg}>
          <Text textStyle={{ fontSize: 34, fontWeight: "800", color: colors.text }}>Merkbeet</Text>
          <Text textStyle={{ fontSize: 16, lineHeight: 23, color: colors.textMuted }}>
            Gib den Code ein, den du von Hauke bekommen hast. Danach siehst du auf jedem Gerät
            denselben Garten.
          </Text>
          <TextInput
            value={code}
            placeholder="Code"
            secureTextEntry
            autoCorrect={false}
            onSubmitEditing={() => void submit()}
          />
          {problem ? (
            <Text textStyle={{ fontSize: 15, color: colors.danger }}>{problem}</Text>
          ) : null}
          <Button variant="filled" label="Garten öffnen" onPress={() => void submit()} />
        </Column>
      </Host>
      {checking ? <ActivityIndicator style={styles.spinner} color={colors.accent} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  spinner: { marginTop: spacing.lg },
});
