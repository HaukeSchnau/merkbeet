import { useSharedValue, type SharedValue } from "react-native-reanimated";

import type { Rect } from "../garden/types";

/**
 * Bildschirmkoordinate = Weltmeter * scale + translation.
 * `scale` ist damit direkt "Pixel pro Meter".
 */
export type Viewport = {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  scale: SharedValue<number>;
};

export type Screen = { width: number; height: number };

/** Zoomstufe, bei der der ganze Plan auf den Bildschirm passt. */
export const fitScale = (bounds: Rect, screen: Screen): number =>
  Math.min(screen.width / bounds.width, screen.height / bounds.height);

/** Grenzen des Zooms: etwas weiter raus als die Uebersicht, rein bis Detailansicht. */
export const scaleLimits = (bounds: Rect, screen: Screen) => {
  const fit = fitScale(bounds, screen);
  return { min: fit * 0.85, max: Math.max(fit * 12, 200) };
};

export const useViewport = (): Viewport => ({
  tx: useSharedValue(0),
  ty: useSharedValue(0),
  scale: useSharedValue(1),
});

/**
 * Haelt den Plan auf dem Bildschirm: ist er groesser als das Fenster, darf
 * nicht ueber die Kante hinaus geschoben werden; ist er kleiner, wird er
 * zentriert.
 */
export const clampTranslation = (
  value: number,
  scale: number,
  boundsStart: number,
  boundsSize: number,
  screenSize: number,
): number => {
  "worklet";
  const sizePx = boundsSize * scale;
  const startPx = boundsStart * scale;
  if (sizePx <= screenSize) return (screenSize - sizePx) / 2 - startPx;
  return Math.min(-startPx, Math.max(screenSize - startPx - sizePx, value));
};

/** Startansicht: der ganze Plan, zentriert. */
export const resetViewport = (viewport: Viewport, bounds: Rect, screen: Screen) => {
  const scale = fitScale(bounds, screen);
  viewport.scale.value = scale;
  viewport.tx.value = (screen.width - bounds.width * scale) / 2 - bounds.x * scale;
  viewport.ty.value = (screen.height - bounds.height * scale) / 2 - bounds.y * scale;
};
