import { Directory, File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

const PHOTO_DIRECTORY = "plant-photos";

/**
 * Waehlt ein Foto aus der Galerie und legt eine dauerhafte Kopie im
 * App-Verzeichnis ab. Die URI der Galerie selbst ist nur temporaer und waere
 * beim naechsten Start moeglicherweise ungueltig.
 */
export const pickPlantPhoto = async (plantId: string): Promise<string | null> => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;

  const directory = new Directory(Paths.document, PHOTO_DIRECTORY);
  if (!directory.exists) directory.create({ intermediates: true });

  const target = new File(directory, `${plantId}-${Date.now()}.jpg`);
  await new File(asset.uri).copy(target);
  return target.uri;
};
