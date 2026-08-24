import {
  BottomSheet,
  Button,
  FieldGroup,
  Host,
  Row,
  Slider,
  Text,
  TextInput,
  useNativeState,
} from "@expo/ui";
import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { speciesOf } from "../garden/species";
import type { Plant, PlantEdits, PlantId } from "../garden/types";
import { resolvePhotoUri } from "../sync/endpoint";
import { formatGermanDate, parseGermanDate, todayIso } from "./dates";
import { pickAndUploadPhoto } from "./photos";
import { colors, radii, spacing } from "./theme";

export type PlantSheetProps = {
  plant: Plant | null;
  editMode: boolean;
  /** Fotos gehen zum Server, dafür wird der Zugangscode gebraucht. */
  passcode: string | null;
  onClose: () => void;
  /**
   * Die Pflanze wird mitgegeben statt aus der Auswahl gelesen: Änderungen
   * laufen beim Tippen los, und bis sie ankommen, kann die Auswahl schon eine
   * andere sein.
   */
  onEdit: (id: PlantId, edits: PlantEdits) => void;
  onRemove: () => void;
};

const komma = (value: number) => value.toFixed(1).replace(".", ",");

/**
 * Detailkarte einer Pflanze als natives Bottom Sheet.
 *
 * Im Lesemodus reine Anzeige, im Bearbeiten-Modus mit Eingabefeldern -- damit
 * im Alltag nichts versehentlich verändert wird. Die Größe ist ein Slider statt
 * zweier Knöpfe: eine Pflanze wächst stufenlos, und auf dem Gerät ist das der
 * Regler, den das System selbst benutzt.
 */
export const PlantSheet = ({
  plant,
  editMode,
  passcode,
  onClose,
  onEdit,
  onRemove,
}: PlantSheetProps) => {
  const name = useNativeState("");
  const notes = useNativeState("");
  const dateDraft = useNativeState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);

  // Beim Wechsel der Pflanze die Felder nachziehen.
  useEffect(() => {
    name.value = plant?.name ?? "";
    notes.value = plant?.notes ?? "";
    dateDraft.value = formatGermanDate(plant?.plantedAt);
    setPhotoProblem(null);
  }, [plant?.id, plant?.name, plant?.notes, plant?.plantedAt, name, notes, dateDraft]);

  const species = plant ? speciesOf(plant.speciesId) : null;
  const diameter = plant && species ? (plant.diameterMeters ?? species.defaultDiameterMeters) : 1;

  // Die Hooks stehen alle oben, damit der frühe Ausstieg unten die Reihenfolge
  // nicht verändert.

  /**
   * Das Datum braucht einen eigenen Entwurf, weil "14.0" noch kein Datum ist.
   * Sobald die Eingabe ein gültiges Datum ergibt, wird sie übernommen.
   */
  const changeDate = (text: string) => {
    if (!plant) return;
    dateDraft.value = text;
    if (text.trim() === "") {
      onEdit(plant.id, { plantedAt: undefined });
      return;
    }
    const iso = parseGermanDate(text);
    if (iso) onEdit(plant.id, { plantedAt: iso });
  };

  // Nur einhängen, wenn wirklich eine Pflanze offen ist. Ein dauerhaft
  // eingehängter, bildschirmfüllender Host verschluckt sonst jede Berührung --
  // auf iOS Safari war damit nach dem Anmelden die ganze App tot.
  if (!plant || !species) return null;

  return (
    <Host seedColor={colors.accent} style={styles.host}>
      <BottomSheet isPresented onDismiss={onClose} snapPoints={["half", "full"]} showDragIndicator>
        {(
          <>
            {plant.photoUri ? <PlantPhoto uri={resolvePhotoUri(plant.photoUri)} /> : null}

            {editMode ? (
              <FieldGroup style={{ width: "100%" }}>
                <FieldGroup.Section title="Pflanze">
                  <TextInput
                    value={name}
                    placeholder={species.name}
                    // Beim Tippen übernehmen: das Verschicken ist ohnehin
                    // gebündelt, und niemand soll eine Notiz verlieren, weil er
                    // die Karte zuschiebt, ohne das Feld zu verlassen.
                    onChangeText={(text) =>
                      onEdit(plant.id, { name: text.trim() === "" ? undefined : text })
                    }
                  />
                  <TextInput
                    value={dateDraft}
                    placeholder="Gepflanzt am (TT.MM.JJJJ)"
                    keyboardType="numbers-and-punctuation"
                    onChangeText={changeDate}
                  />
                  <TextInput
                    value={notes}
                    placeholder="Notizen"
                    multiline
                    numberOfLines={4}
                    onChangeText={(text) =>
                      onEdit(plant.id, { notes: text.trim() === "" ? undefined : text })
                    }
                  />
                </FieldGroup.Section>

                <FieldGroup.Section title={`Grösse — ${komma(diameter)} m Durchmesser`}>
                  <Slider
                    value={diameter}
                    min={0.2}
                    max={6}
                    step={0.1}
                    onValueChange={(value) =>
                      onEdit(plant.id, { diameterMeters: Math.round(value * 10) / 10 })
                    }
                  />
                </FieldGroup.Section>

                <FieldGroup.Section>
                  <Button
                    variant="outlined"
                    label="Heute als Pflanzdatum"
                    onPress={() => {
                      const iso = todayIso();
                      dateDraft.value = formatGermanDate(iso);
                      onEdit(plant.id, { plantedAt: iso });
                    }}
                  />
                  <Button
                    variant="outlined"
                    label={
                      photoBusy ? "Lädt hoch …" : plant.photoUri ? "Foto ersetzen" : "Foto hinzufügen"
                    }
                    onPress={() => {
                      if (photoBusy || !passcode) return;
                      setPhotoBusy(true);
                      setPhotoProblem(null);
                      void pickAndUploadPhoto(passcode)
                        .then((result) => {
                          if (result.ok) onEdit(plant.id, { photoUri: result.photoUri });
                          else if (result.reason === "offline")
                            setPhotoProblem("Für ein Foto braucht Merkbeet kurz eine Verbindung.");
                          else if (result.reason === "abgelehnt")
                            setPhotoProblem("Dieses Bild konnte nicht gespeichert werden.");
                        })
                        .finally(() => setPhotoBusy(false));
                    }}
                  />
                  {photoProblem ? (
                    <Text textStyle={{ fontSize: 14, color: colors.danger }}>{photoProblem}</Text>
                  ) : null}
                  <Button variant="text" label="Pflanze entfernen" onPress={onRemove} />
                </FieldGroup.Section>
              </FieldGroup>
            ) : (
              <FieldGroup style={{ width: "100%" }}>
                <FieldGroup.Section title={plant.name ?? species.name}>
                  {species.botanical ? (
                    <Text textStyle={{ fontSize: 14, color: colors.textMuted }}>
                      {species.botanical}
                    </Text>
                  ) : null}
                  <Detail label="Gepflanzt" value={formatGermanDate(plant.plantedAt) || "nicht notiert"} />
                  <Detail label="Grösse" value={`${komma(diameter)} m Durchmesser`} />
                  <Detail
                    label="Position"
                    value={`${komma(plant.position.x)} m / ${komma(plant.position.y)} m`}
                  />
                </FieldGroup.Section>
                {plant.notes ? (
                  <FieldGroup.Section title="Notizen">
                    <Text textStyle={{ fontSize: 15, lineHeight: 22, color: colors.text }}>
                      {plant.notes}
                    </Text>
                  </FieldGroup.Section>
                ) : null}
              </FieldGroup>
            )}
          </>
        )}
      </BottomSheet>
    </Host>
  );
};

const Detail = ({ label, value }: { label: string; value: string }) => (
  <Row spacing={spacing.sm}>
    <Text textStyle={{ fontSize: 15, color: colors.textMuted }}>{label}</Text>
    <Text textStyle={{ fontSize: 15, fontWeight: "600", color: colors.text }}>{value}</Text>
  </Row>
);

const PlantPhoto = ({ uri }: { uri: string }) => (
  <View style={styles.photoWrap}>
    <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
  </View>
);

const styles = StyleSheet.create({
  /**
   * Der Host spannt die ganze Fläche auf, damit das Sheet seine Breite kennt --
   * mit Breite 0 wurde der Inhalt zusammengequetscht. Er wird nur eingehängt,
   * solange eine Pflanze offen ist, sonst würde er alle Berührungen abfangen.
   */
  host: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  photoWrap: { paddingHorizontal: spacing.lg },
  photo: {
    width: "100%",
    height: 180,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
});
