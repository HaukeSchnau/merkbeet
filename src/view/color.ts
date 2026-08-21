/**
 * Farben vorab mischen.
 *
 * Die Bodentextur liegt immer direkt auf der Grundfarbe ihrer Fläche. Statt sie
 * mit Deckkraft darüber zu zeichnen, wird das Ergebnis einmal ausgerechnet und
 * deckend gezeichnet -- dann muss Skia beim Zeichnen nicht pro Pixel mischen.
 * Bei starkem Zoom ist genau das der Engpass, weil dieselben Formen dann sehr
 * viele Pixel bedecken.
 *
 * Der Unterschied ist dort sichtbar, wo sich zwei Texturschichten überlagern:
 * die obere dunkelt die untere nicht weiter ab. Bei Erde und Gras fällt das
 * nicht auf.
 */

const parse = (hex: string): [number, number, number] => {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
};

const toHex = (channel: number): string =>
  Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0");

/** `color` mit `alpha` über `base` gelegt, als deckende Farbe. */
export const over = (base: string, color: string, alpha: number): string => {
  const [br, bg, bb] = parse(base);
  const [cr, cg, cb] = parse(color);
  const mix = (b: number, c: number) => b + (c - b) * alpha;
  return `#${toHex(mix(br, cr))}${toHex(mix(bg, cg))}${toHex(mix(bb, cb))}`;
};
