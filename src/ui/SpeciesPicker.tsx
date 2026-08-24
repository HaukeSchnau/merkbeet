import { BottomSheet, Host, List, ListItem, Text } from "@expo/ui";
import { StyleSheet, View } from "react-native";

import { SPECIES, SPECIES_IDS, type SpeciesId } from "../garden/species";
import { colors, radii } from "./theme";

export type SpeciesPickerProps = {
  visible: boolean;
  onPick: (id: SpeciesId) => void;
  onCancel: () => void;
};

/** Farbtupfer als Vorschau -- dieselbe Palette, die der Plan verwendet. */
const swatchColor = (id: SpeciesId): string => {
  const { art } = SPECIES[id];
  return art.kind === "procedural" ? (art.palette.bloom ?? art.palette.leafMid) : colors.surfaceMuted;
};

/**
 * Artenauswahl als natives Bottom Sheet mit einer Systemliste: auf Android
 * Material 3, auf iOS eine SwiftUI-Liste, im Browser ein Nachbau.
 */
export const SpeciesPicker = ({ visible, onPick, onCancel }: SpeciesPickerProps) => {
  // Nur einhängen, wenn wirklich etwas zu zeigen ist. Ein dauerhaft
  // eingehängter, bildschirmfüllender Host verschluckt sonst jede Berührung --
  // auf iOS Safari war damit nach dem Anmelden die ganze App tot.
  if (!visible) return null;

  return (
    <Host seedColor={colors.accent} style={styles.host}>
      <BottomSheet isPresented onDismiss={onCancel} snapPoints={["half", "full"]}>
        <List>
          {SPECIES_IDS.map((id) => (
            <ListItem
              key={id}
              onPress={() => onPick(id)}
              leading={<Swatch color={swatchColor(id)} />}
              supportingText={SPECIES[id].botanical}
            >
              <Text>{SPECIES[id].name}</Text>
            </ListItem>
          ))}
        </List>
      </BottomSheet>
    </Host>
  );
};

const Swatch = ({ color }: { color: string }) => (
  <View style={[styles.swatch, { backgroundColor: color }]} />
);

const styles = StyleSheet.create({
  /**
   * Der Host spannt die ganze Fläche auf, damit das Sheet seine Breite kennt --
   * mit Breite 0 wurde der Inhalt zusammengequetscht. Er wird nur eingehängt,
   * solange das Sheet offen ist, sonst würde er alle Berührungen abfangen.
   */
  host: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  swatch: { width: 30, height: 30, borderRadius: radii.pill },
});
