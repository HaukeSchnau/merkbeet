import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { speciesOf } from "../garden/species";
import type { Plant, PlantEdits } from "../garden/types";
import { formatGermanDate, parseGermanDate, todayIso } from "./dates";
import { pickPlantPhoto } from "./photos";
import { colors, radii, spacing } from "./theme";

export type PlantSheetProps = {
  plant: Plant | null;
  editMode: boolean;
  onClose: () => void;
  onEdit: (edits: PlantEdits) => void;
  onRemove: () => void;
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

/**
 * Detailkarte einer Pflanze. Im Lesemodus reine Anzeige, im Bearbeiten-Modus
 * mit Eingabefeldern -- damit im Alltag nichts versehentlich veraendert wird.
 */
export const PlantSheet = ({ plant, editMode, onClose, onEdit, onRemove }: PlantSheetProps) => {
  const [dateDraft, setDateDraft] = useState("");

  // Der Datumsentwurf ist lokal, weil eine halb getippte Eingabe noch kein
  // gueltiges Datum ist und deshalb nicht gespeichert werden darf.
  useEffect(() => {
    setDateDraft(formatGermanDate(plant?.plantedAt));
  }, [plant?.id, plant?.plantedAt]);

  if (!plant) return null;
  const species = speciesOf(plant.speciesId);
  const diameter = plant.diameterMeters ?? species.defaultDiameterMeters;

  const commitDate = () => {
    if (dateDraft.trim() === "") {
      onEdit({ plantedAt: undefined });
      return;
    }
    const iso = parseGermanDate(dateDraft);
    if (iso) onEdit({ plantedAt: iso });
    else setDateDraft(formatGermanDate(plant.plantedAt));
  };

  const changeDiameter = (delta: number) => {
    onEdit({ diameterMeters: Math.round(Math.min(6, Math.max(0.2, diameter + delta)) * 10) / 10 });
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {plant.photoUri ? (
            <Image source={{ uri: plant.photoUri }} style={styles.photo} resizeMode="cover" />
          ) : null}

          {editMode ? (
            <Field label="Name">
              <TextInput
                style={styles.input}
                defaultValue={plant.name ?? ""}
                placeholder={species.name}
                placeholderTextColor={colors.textMuted}
                onEndEditing={(event) => {
                  const value = event.nativeEvent.text.trim();
                  onEdit({ name: value === "" ? undefined : value });
                }}
              />
            </Field>
          ) : (
            <>
              <Text style={styles.title}>{plant.name ?? species.name}</Text>
              {species.botanical ? <Text style={styles.subtitle}>{species.botanical}</Text> : null}
            </>
          )}

          {editMode ? (
            <>
              <Field label="Gepflanzt">
                <View style={styles.inline}>
                  <TextInput
                    style={[styles.input, styles.inlineInput]}
                    value={dateDraft}
                    placeholder="TT.MM.JJJJ"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numbers-and-punctuation"
                    onChangeText={setDateDraft}
                    onEndEditing={commitDate}
                  />
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      const iso = todayIso();
                      setDateDraft(formatGermanDate(iso));
                      onEdit({ plantedAt: iso });
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Heute</Text>
                  </Pressable>
                </View>
              </Field>

              <Field label="Grösse (Durchmesser)">
                <View style={styles.inline}>
                  <Pressable style={styles.stepper} onPress={() => changeDiameter(-0.1)}>
                    <Text style={styles.stepperText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepperValue}>{diameter.toFixed(1).replace(".", ",")} m</Text>
                  <Pressable style={styles.stepper} onPress={() => changeDiameter(0.1)}>
                    <Text style={styles.stepperText}>+</Text>
                  </Pressable>
                </View>
              </Field>

              <Field label="Notizen">
                <TextInput
                  style={[styles.input, styles.multiline]}
                  defaultValue={plant.notes ?? ""}
                  placeholder="Standort, Pflege, Herkunft …"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  onEndEditing={(event) => {
                    const value = event.nativeEvent.text.trim();
                    onEdit({ notes: value === "" ? undefined : value });
                  }}
                />
              </Field>

              <Pressable
                style={styles.secondaryButtonWide}
                onPress={() => {
                  void pickPlantPhoto(plant.id).then((uri) => {
                    if (uri) onEdit({ photoUri: uri });
                  });
                }}
              >
                <Text style={styles.secondaryButtonText}>
                  {plant.photoUri ? "Foto ersetzen" : "Foto hinzufügen"}
                </Text>
              </Pressable>

              <Pressable style={styles.dangerButton} onPress={onRemove}>
                <Text style={styles.dangerButtonText}>Pflanze entfernen</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Row label="Gepflanzt" value={formatGermanDate(plant.plantedAt) || "nicht notiert"} />
              <Row label="Grösse" value={`${diameter.toFixed(1).replace(".", ",")} m Durchmesser`} />
              <Row
                label="Position"
                value={`${plant.position.x.toFixed(1).replace(".", ",")} m / ${plant.position.y
                  .toFixed(1)
                  .replace(".", ",")} m`}
              />
              {plant.notes ? <Text style={styles.notes}>{plant.notes}</Text> : null}
            </>
          )}
        </ScrollView>

        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Schliessen</Text>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(28, 24, 18, 0.35)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: spacing.xl,
    maxHeight: "82%",
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    marginTop: spacing.md,
  },
  content: { padding: spacing.lg, gap: spacing.md },
  photo: { width: "100%", height: 180, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, fontStyle: "italic", color: colors.textMuted, marginTop: -spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  rowLabel: { fontSize: 15, color: colors.textMuted },
  rowValue: { fontSize: 15, fontWeight: "600", color: colors.text },
  notes: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  field: { gap: spacing.xs },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 88, textAlignVertical: "top" },
  inline: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  inlineInput: { flex: 1 },
  secondaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  secondaryButtonWide: {
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  secondaryButtonText: { fontSize: 15, fontWeight: "600", color: colors.text },
  stepper: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperText: { fontSize: 24, fontWeight: "600", color: colors.text },
  stepperValue: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "600", color: colors.text },
  dangerButton: { alignItems: "center", paddingVertical: spacing.md, borderRadius: radii.md },
  dangerButtonText: { fontSize: 15, fontWeight: "600", color: colors.danger },
  closeButton: { alignItems: "center", paddingVertical: spacing.md },
  closeButtonText: { fontSize: 16, fontWeight: "700", color: colors.accent },
});
