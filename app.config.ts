import type { ExpoConfig } from "expo/config";

/**
 * Der Basispfad hängt davon ab, wohin exportiert wird: der Sync-Dienst liefert
 * die App unter / aus, die Tailnet-Vorschau liegt in einem Unterordner.
 * Deshalb kommt er aus der Umgebung statt fest im Config zu stehen.
 */
const baseUrl = process.env.MERKBEET_BASE_URL ?? "";

const config: ExpoConfig = {
  name: "Merkbeet",
  slug: "merkbeet",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "dev.schnau.merkbeet",
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    package: "dev.schnau.merkbeet",
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
  },
  plugins: [
    [
      "expo-image-picker",
      { photosPermission: "Merkbeet zeigt Fotos deiner Pflanzen in der Pflanzenkarte." },
    ],
  ],
  experiments: { baseUrl },
};

export default config;
