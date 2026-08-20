import { File } from "expo-file-system";

/**
 * Liest das ausgewählte Bild als Bytes. Native kommt eine `file://`-Adresse,
 * die das Dateisystem-Modul direkt lesen kann. Die Web-Variante steht in
 * `photoBytes.web.ts`; Metro wählt sie automatisch.
 */
export const readPhotoBytes = (uri: string): Promise<Uint8Array> => new File(uri).bytes();
