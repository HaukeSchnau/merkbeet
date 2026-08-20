import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

/**
 * Im Browser laeuft Skia als WASM (CanvasKit) und muss geladen sein, bevor
 * irgendein Skia-Modul ausgewertet wird. Der Import steht hier statisch, damit
 * der Loader im Hauptbundle landet -- als dynamischer Import wuerde Metro ein
 * eigenes Bundle daraus machen, das sich `global` nicht mit dem Rest teilt.
 */
export const loadSkia = LoadSkiaWeb;
