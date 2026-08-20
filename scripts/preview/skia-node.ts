/**
 * Ersetzt "@shopify/react-native-skia" beim Rendern in Node. Es wird dieselbe
 * Skia-Implementierung benutzt, die auch im Browser laeuft (CanvasKit/WASM) --
 * nur ohne React Native drumherum. So kann `bun run preview` die echten
 * Zeichenfunktionen aufrufen und PNGs herausschreiben.
 */
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web";
import type { SkCanvas, SkPicture, SkRect, SkSize } from "@shopify/react-native-skia";

export const CanvasKit = await CanvasKitInit();

/**
 * Die Deklarationen liegen im Paket zweimal (commonjs und typescript). Der
 * Umweg ueber `unknown` bruecktt diese Kopien -- zur Laufzeit ist es dasselbe
 * Objekt.
 */
export const Skia = JsiSkApi(CanvasKit) as unknown as typeof import("@shopify/react-native-skia").Skia;

export {
  BlurStyle,
  ClipOp,
  PaintStyle,
  StrokeCap,
  StrokeJoin,
} from "@shopify/react-native-skia/lib/commonjs/skia/types";

/** Nachbau von `createPicture`; das Original haengt an React Native. */
export const createPicture = (cb: (canvas: SkCanvas) => void, rect?: SkRect | SkSize): SkPicture => {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(
    rect && "width" in rect && !("x" in rect)
      ? Skia.XYWHRect(0, 0, rect.width, rect.height)
      : (rect as SkRect | undefined),
  );
  cb(canvas);
  return recorder.finishRecordingAsPicture();
};
