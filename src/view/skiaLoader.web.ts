import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

/**
 * Im Browser laeuft Skia als WASM (CanvasKit) und muss geladen sein, bevor
 * irgendein Skia-Modul ausgewertet wird. Der Import steht hier statisch, damit
 * der Loader im Hauptbundle landet -- als dynamischer Import wuerde Metro ein
 * eigenes Bundle daraus machen, das sich `global` nicht mit dem Rest teilt.
 */

/** Wird von babel-preset-expo aus `experiments.baseUrl` eingesetzt. */
const BASE_URL = process.env.EXPO_BASE_URL ?? "";

export const loadSkia = () =>
  // canvaskit.wasm liegt in `public/` und damit direkt unter dem Basispfad.
  // Ohne locateFile sucht Emscripten neben dem JS-Bundle, das mehrere Ebenen
  // tiefer liegt.
  LoadSkiaWeb({ locateFile: (file) => `${BASE_URL}/${file}` });
