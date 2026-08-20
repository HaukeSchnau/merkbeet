import { Platform } from "react-native";

/**
 * Wo der Sync-Dienst liegt.
 *
 * Im Browser liefert der Dienst den Web-Client selbst aus, deshalb genügen
 * relative Pfade -- das erspart CORS und funktioniert auch, wenn die App mal
 * unter einem anderen Namen läuft. Native braucht eine absolute Adresse.
 * `EXPO_PUBLIC_MERKBEET_SERVER` überschreibt beides, z.B. um eine
 * Vorschau-Version auf den echten Server zeigen zu lassen.
 */
export const SERVER_BASE =
  process.env.EXPO_PUBLIC_MERKBEET_SERVER ?? (Platform.OS === "web" ? "" : "https://merkbeet.schnau.dev");

/** Macht aus dem synchronisierten `photoUri` eine ladbare Adresse. */
export const resolvePhotoUri = (photoUri: string): string =>
  photoUri.startsWith("/api/photos/") ? `${SERVER_BASE}${photoUri}` : photoUri;
