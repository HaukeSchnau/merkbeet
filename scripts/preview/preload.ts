import { plugin } from "bun";

/**
 * Leitet Importe von "@shopify/react-native-skia" auf die Node-Variante um,
 * damit der Zeichencode der App ausserhalb von React Native laufen kann.
 */
plugin({
  name: "skia-node",
  setup(build) {
    build.module("@shopify/react-native-skia", async () => ({
      exports: (await import("./skia-node")) as Record<string, unknown>,
      loader: "object",
    }));
  },
});
