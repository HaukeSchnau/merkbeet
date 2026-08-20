import * as ImagePicker from "expo-image-picker";

import { uploadPhoto } from "../sync/client";
import { readPhotoBytes } from "./photoBytes";

/**
 * Fotos gehören zum geteilten Stand, also müssen sie auf den Server -- eine
 * lokale Dateiadresse wäre auf den anderen Geräten wertlos. Deshalb braucht
 * das Hinzufügen eines Fotos eine Verbindung; alles andere in der App
 * funktioniert auch offline.
 */
export type PhotoOutcome =
  | { ok: true; photoUri: string }
  | { ok: false; reason: "abgebrochen" | "offline" | "abgelehnt" };

export const pickAndUploadPhoto = async (passcode: string): Promise<PhotoOutcome> => {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    // Etwas herunterrechnen: die Bilder sollen über Mobilfunk hochgehen.
    quality: 0.6,
  });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return { ok: false, reason: "abgebrochen" };

  const bytes = await readPhotoBytes(asset.uri);
  const result = await uploadPhoto(passcode, bytes, asset.mimeType ?? "image/jpeg");
  if (result.ok) return { ok: true, photoUri: result.value.photoUri };
  return { ok: false, reason: result.failure.kind === "offline" ? "offline" : "abgelehnt" };
};
