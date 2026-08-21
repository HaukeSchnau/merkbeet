import {
  BlurStyle,
  PaintStyle,
  Skia,
  type SkCanvas,
  type SkPaint,
} from "@shopify/react-native-skia";

import { speciesOf, type Species } from "../garden/species";
import { MATERIAL } from "./ground";
import { createPlantPicture, drawStar } from "./plantArt";
import { makeRng } from "./rng";

/**
 * Das App-Icon wird aus demselben Code gezeichnet wie der Garten selbst: die
 * Sternmagnolie von oben, auf Beeterde. Sie ist die größte Pflanze im echten
 * Beet der Eltern und trägt weiße Sternblüten -- weiß auf dunkelgrün liest sich
 * auch als 48-Pixel-Symbol noch.
 *
 * Alles wird in einem Koordinatensystem von 0..1 gezeichnet und über die Matrix
 * auf die Zielgröße skaliert, damit dieselbe Funktion 1024er Icons und ein
 * 64er Favicon liefert.
 */

export type IconVariant =
  /** Vollflächig: Erde plus Pflanze. Für icon.png und favicon. */
  | "full"
  /** Nur die Pflanze auf Transparenz, innerhalb der Android-Sicherheitszone. */
  | "foreground"
  /** Nur die Erde. Hintergrund des adaptiven Android-Icons. */
  | "background"
  /** Weiße Silhouette auf Transparenz; Android färbt sie selbst ein. */
  | "monochrome";

/**
 * Android beschneidet das Vordergrundbild adaptiver Icons: garantiert sichtbar
 * ist nur der innere Kreis von etwa zwei Dritteln der Kantenlänge.
 */
const SAFE_ZONE = 0.66;

const fill = (color: string, alpha = 1): SkPaint => {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  if (alpha < 1) paint.setAlphaf(alpha);
  return paint;
};

/**
 * Erde mit groben Schollen -- fein gestreute Körnung würde klein verschmieren.
 * Bewusst der dunklere Erdton: das Grün der Pflanze soll sich abheben.
 */
const drawSoil = (canvas: SkCanvas) => {
  canvas.drawRect(Skia.XYWHRect(0, 0, 1, 1), fill(MATERIAL.soil.dark));
  const rng = makeRng("icon:soil");
  for (let i = 0; i < 22; i++) {
    canvas.drawOval(
      Skia.XYWHRect(rng.range(-0.1, 1), rng.range(-0.1, 1), rng.range(0.12, 0.34), rng.range(0.08, 0.2)),
      fill(rng.next() > 0.5 ? MATERIAL.soil.dark : MATERIAL.soil.light, 0.34),
    );
  }
  // Zum Rand hin abdunkeln, damit die Fläche nicht flach wirkt.
  const vignette = fill(MATERIAL.soil.mulch, 0.3);
  vignette.setStyle(PaintStyle.Stroke);
  vignette.setStrokeWidth(0.3);
  vignette.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 0.09, true));
  canvas.drawRect(Skia.XYWHRect(-0.15, -0.15, 1.3, 1.3), vignette);
};

/**
 * Die Pflanze wie im Plan -- aber die Blüten werden hier selbst gesetzt.
 * Die Art streut sieben kleine Sterne zufällig; als 48-Pixel-Symbol
 * verschmelzen die zu einem Fleck. Vier große an festen Stellen bleiben
 * einzeln erkennbar, in derselben Form und Farbe wie im Garten.
 */
const drawPlant = (canvas: SkCanvas, diameter: number) => {
  const species = speciesOf("magnolia");
  if (species.art.kind !== "procedural") return;
  const { palette } = species.art;

  const canopy: Species = {
    ...species,
    art: { ...species.art, bloom: "none" },
  };

  canvas.save();
  canvas.translate(0.5, 0.5);
  // createPlantPicture zeichnet in Metern; hier ist 1 Einheit die Icon-Kante.
  const meters = species.defaultDiameterMeters;
  canvas.scale(diameter / meters, diameter / meters);
  canvas.drawPicture(createPlantPicture(canopy, meters, "icon:magnolia"));
  canvas.restore();

  const rng = makeRng("icon:blossoms");
  const radius = diameter / 2;
  // Anteile des Kronenradius. Die mittlere Blüte deckt den Stammansatz ab, der
  // sonst wie ein Loch in der Krone aussieht.
  const places: Array<[number, number]> = [
    [-0.46, -0.4],
    [0.44, -0.34],
    [-0.36, 0.42],
    [0.42, 0.4],
    [0.04, 0.02],
  ];
  canvas.save();
  canvas.translate(0.5, 0.5);
  for (const [x, y] of places) {
    drawStar(canvas, x * radius, y * radius, radius * 0.34, palette, rng);
  }
  canvas.restore();
};

/**
 * Für das monochrome Icon eine eigene, stark vereinfachte Form: eine
 * Sternblüte über einem Blattkranz. Die volle Pflanze hat ihre Farben
 * eingebacken und würde als Silhouette zu einem Fleck.
 */
const drawSilhouette = (canvas: SkCanvas) => {
  const ink = fill("#ffffff");
  canvas.save();
  canvas.translate(0.5, 0.5);

  // Nur die Blüte, mit deutlichen Lücken zwischen den Blättern. Ein Blattkranz
  // dahinter würde bei einer einfarbigen Silhouette damit verschmelzen.
  for (let i = 0; i < 8; i++) {
    canvas.save();
    canvas.rotate(i * 45, 0, 0);
    canvas.drawOval(Skia.XYWHRect(-0.028, -0.36, 0.056, 0.3), ink);
    canvas.restore();
  }
  canvas.drawCircle(0, 0, 0.075, ink);
  canvas.restore();
};

/**
 * Zeichnet eine Icon-Variante. `canvas` muss so eingerichtet sein, dass
 * (0,0)-(1,1) die Icon-Fläche ist.
 */
export const drawIcon = (canvas: SkCanvas, variant: IconVariant): void => {
  if (variant === "background") {
    drawSoil(canvas);
    return;
  }
  if (variant === "monochrome") {
    drawSilhouette(canvas);
    return;
  }
  if (variant === "full") {
    // Kein eigener Rahmen: iOS und Android maskieren Icons rund, ein gezeichneter
    // Rand würde an den Ecken angeschnitten aussehen.
    drawSoil(canvas);
    drawPlant(canvas, 0.72);
    return;
  }
  drawPlant(canvas, SAFE_ZONE * 0.94);
};
