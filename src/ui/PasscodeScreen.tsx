import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { checkPasscode } from "../sync/client";
import { colors, radii, spacing } from "./theme";

export type PasscodeScreenProps = {
  onAccepted: (passcode: string) => void;
};

/**
 * Der Zugang zum gemeinsamen Gartenstand. Ein Code für die ganze Familie
 * statt eigener Konten: es gibt genau einen Garten, und niemand soll sich ein
 * Passwort merken müssen. Der Code wird auf dem Gerät gespeichert, die Abfrage
 * kommt also nur beim ersten Mal.
 */
export const PasscodeScreen = ({ onAccepted }: PasscodeScreenProps) => {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = code.trim();
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
      <Text style={styles.title}>Merkbeet</Text>
      <Text style={styles.intro}>
        Gib den Code ein, den du von Hauke bekommen hast. Danach siehst du auf jedem Gerät denselben
        Garten.
      </Text>

      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholder="Code"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />

      {problem ? <Text style={styles.problem}>{problem}</Text> : null}

      <Pressable
        style={[styles.button, (checking || code.trim() === "") && styles.buttonDisabled]}
        onPress={() => void submit()}
        disabled={checking || code.trim() === ""}
      >
        {checking ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.buttonText}>Garten öffnen</Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 34, fontWeight: "800", color: colors.text },
  intro: { fontSize: 16, lineHeight: 23, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    fontSize: 18,
    color: colors.text,
  },
  problem: { fontSize: 15, color: colors.danger },
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 17, fontWeight: "700", color: colors.surface },
});
