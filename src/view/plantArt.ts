import {
  BlurStyle,
  PaintStyle,
  Skia,
  StrokeCap,
  createPicture,
  type SkCanvas,
  type SkPaint,
  type SkPicture,
} from "@shopify/react-native-skia";

import type { BloomStyle, PlantPalette, Species } from "../garden/species";
import { makeRng, type Rng } from "./rng";

/**
 * Zeichnet eine Pflanze von oben als Skia-Picture, in Metern und zentriert auf
 * (0, 0). Ein Picture ist ein aufgezeichneter Vektor-Befehlssatz: einmal
 * erzeugt, bleibt es bei jedem Zoom scharf und kostet pro Frame nur einen
 * Draw-Call.
 */

const fill = (color: string, alpha = 1): SkPaint => {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  if (alpha < 1) paint.setAlphaf(alpha);
  return paint;
};

const blurred = (color: string, sigmaMeters: number, alpha: number): SkPaint => {
  const paint = fill(color, alpha);
  paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, sigmaMeters, true));
  return paint;
};

/** Ein einzelnes Blatt: gedrehtes Oval, laenger als breit. */
const drawLeaf = (
  canvas: SkCanvas,
  x: number,
  y: number,
  length: number,
  width: number,
  angleDeg: number,
  paint: SkPaint,
) => {
  canvas.save();
  canvas.translate(x, y);
  canvas.rotate(angleDeg, 0, 0);
  canvas.drawOval(Skia.XYWHRect(-width / 2, -length / 2, width, length), paint);
  canvas.restore();
};

/**
 * Ein Blattkranz: `count` Blaetter auf einem Ring mit Radius `radius`, jeweils
 * nach aussen zeigend. Erzeugt zusammengesetzt die Kuppelform des Strauchs.
 */
const drawLeafRing = (
  canvas: SkCanvas,
  radius: number,
  count: number,
  leafLength: number,
  leafWidth: number,
  paint: SkPaint,
  rng: Rng,
) => {
  const step = 360 / count;
  const phase = rng.range(0, step);
  for (let i = 0; i < count; i++) {
    const angle = phase + i * step + rng.jitter(0, step * 0.35);
    const rad = (angle * Math.PI) / 180;
    const r = rng.jitter(radius, radius * 0.12);
    drawLeaf(
      canvas,
      Math.cos(rad) * r,
      Math.sin(rad) * r,
      rng.jitter(leafLength, leafLength * 0.18),
      rng.jitter(leafWidth, leafWidth * 0.18),
      angle + 90,
      paint,
    );
  }
};

/** Dichter, runder Strauch: aussen dunkel, innen hell -- liest sich als Kuppel. */
const drawMound = (canvas: SkCanvas, radius: number, palette: PlantPalette, rng: Rng) => {
  const rings: Array<{ r: number; count: number; color: string; leaf: number }> = [
    { r: radius * 0.88, count: 16, color: palette.leafTip ?? palette.leafDark, leaf: 0.5 },
    { r: radius * 0.64, count: 13, color: palette.leafDark, leaf: 0.48 },
    { r: radius * 0.4, count: 10, color: palette.leafMid, leaf: 0.44 },
    { r: radius * 0.16, count: 7, color: palette.leafLight, leaf: 0.4 },
  ];
  // Grundmasse, damit zwischen den Blaettern kein Boden durchscheint.
  canvas.drawCircle(0, 0, radius * 0.78, fill(palette.leafDark));
  for (const ring of rings) {
    drawLeafRing(canvas, ring.r, ring.count, radius * ring.leaf, radius * ring.leaf * 0.62, fill(ring.color), rng);
  }
};

/** Groesseres Gehoelz: lockerere, groessere Blattlappen und ein Stammansatz. */
const drawCanopy = (canvas: SkCanvas, radius: number, palette: PlantPalette, rng: Rng) => {
  canvas.drawCircle(0, 0, radius * 0.7, fill(palette.leafDark, 0.9));
  const rings: Array<{ r: number; count: number; color: string }> = [
    { r: radius * 0.92, count: 11, color: palette.leafDark },
    { r: radius * 0.68, count: 9, color: palette.leafMid },
    { r: radius * 0.42, count: 7, color: palette.leafMid },
    { r: radius * 0.2, count: 5, color: palette.leafLight },
  ];
  for (const ring of rings) {
    drawLeafRing(canvas, ring.r, ring.count, radius * 0.62, radius * 0.42, fill(ring.color), rng);
  }
  // Stamm blitzt in der Mitte durch die Krone.
  canvas.drawCircle(rng.jitter(0, radius * 0.05), rng.jitter(0, radius * 0.05), radius * 0.09, fill("#5b4432", 0.75));
};

/** Ziergras: einzelne Halme, die vom Horst nach aussen kippen. */
const drawGrass = (canvas: SkCanvas, radius: number, palette: PlantPalette, rng: Rng) => {
  const colors = [palette.leafDark, palette.leafMid, palette.leafLight];
  const blades = 34;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeCap(StrokeCap.Round);
  for (let i = 0; i < blades; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const length = rng.range(radius * 0.55, radius * 1.05);
    const bend = rng.range(-0.35, 0.35);
    const tipX = Math.cos(angle + bend) * length;
    const tipY = Math.sin(angle + bend) * length;
    const midX = Math.cos(angle) * length * 0.55;
    const midY = Math.sin(angle) * length * 0.55;
    const path = Skia.PathBuilder.Make().moveTo(0, 0).quadTo(midX, midY, tipX, tipY).detach();
    paint.setColor(Skia.Color(colors[i % colors.length]));
    paint.setStrokeWidth(radius * rng.range(0.05, 0.09));
    canvas.drawPath(path, paint);
  }
  canvas.drawCircle(0, 0, radius * 0.18, fill(palette.leafDark, 0.85));
};

/** Niedriges Polster, z.B. Lavendel: silbriges Kissen aus kurzen Trieben. */
const drawTuft = (canvas: SkCanvas, radius: number, palette: PlantPalette, rng: Rng) => {
  canvas.drawCircle(0, 0, radius * 0.72, fill(palette.leafDark));
  drawLeafRing(canvas, radius * 0.62, 14, radius * 0.5, radius * 0.2, fill(palette.leafMid), rng);
  drawLeafRing(canvas, radius * 0.3, 9, radius * 0.42, radius * 0.18, fill(palette.leafLight), rng);
};

/** Bluetenkugel aus mehreren kleinen Kreisen -- Hortensie, Schneeball. */
const drawCluster = (canvas: SkCanvas, cx: number, cy: number, size: number, palette: PlantPalette, rng: Rng) => {
  const petals = fill(palette.bloom ?? "#ffffff");
  const core = fill(palette.bloomCore ?? palette.bloom ?? "#ffffff");
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2 + rng.range(0, 0.6);
    canvas.drawCircle(cx + Math.cos(angle) * size * 0.5, cy + Math.sin(angle) * size * 0.5, size * 0.42, petals);
  }
  canvas.drawCircle(cx, cy, size * 0.45, core);
};

/** Aufrechte Bluetenrispe von oben: laenglicher, sich verjuengender Kegel. */
const drawSpike = (canvas: SkCanvas, cx: number, cy: number, size: number, palette: PlantPalette, rng: Rng) => {
  const angle = rng.range(0, 360);
  canvas.save();
  canvas.translate(cx, cy);
  canvas.rotate(angle, 0, 0);
  canvas.drawOval(Skia.XYWHRect(-size * 0.34, -size * 0.85, size * 0.68, size * 1.7), fill(palette.bloom ?? "#ffffff"));
  canvas.drawOval(
    Skia.XYWHRect(-size * 0.2, -size * 0.7, size * 0.4, size * 1.1),
    fill(palette.bloomCore ?? palette.bloom ?? "#ffffff", 0.9),
  );
  canvas.restore();
};

/** Einzelne gefuellte Bluete -- Rose. */
const drawRosette = (canvas: SkCanvas, cx: number, cy: number, size: number, palette: PlantPalette, rng: Rng) => {
  const petals = fill(palette.bloom ?? "#ffffff");
  const phase = rng.range(0, Math.PI);
  for (let i = 0; i < 5; i++) {
    const angle = phase + (i / 5) * Math.PI * 2;
    canvas.drawCircle(cx + Math.cos(angle) * size * 0.42, cy + Math.sin(angle) * size * 0.42, size * 0.46, petals);
  }
  canvas.drawCircle(cx, cy, size * 0.36, fill(palette.bloomCore ?? "#ffffff"));
};

/** Flache Bluetendolde -- Spiere. */
const drawUmbel = (canvas: SkCanvas, cx: number, cy: number, size: number, palette: PlantPalette, rng: Rng) => {
  const petals = fill(palette.bloom ?? "#ffffff", 0.95);
  for (let i = 0; i < 11; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const r = rng.range(0, size * 0.62);
    canvas.drawCircle(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, size * 0.2, petals);
  }
};

/**
 * Sternfoermige Einzelbluete -- Sternmagnolie. Wird auch vom App-Icon benutzt,
 * damit dort dieselbe Bluetenform steht wie im Plan.
 */
export const drawStar = (canvas: SkCanvas, cx: number, cy: number, size: number, palette: PlantPalette, rng: Rng) => {
  const petal = fill(palette.bloom ?? "#ffffff");
  const phase = rng.range(0, 360);
  canvas.save();
  canvas.translate(cx, cy);
  for (let i = 0; i < 8; i++) {
    canvas.save();
    canvas.rotate(phase + i * 45, 0, 0);
    canvas.drawOval(Skia.XYWHRect(-size * 0.1, -size * 0.9, size * 0.2, size * 0.9), petal);
    canvas.restore();
  }
  canvas.drawCircle(0, 0, size * 0.18, fill(palette.bloomCore ?? "#f0dfc8"));
  canvas.restore();
};

const BLOOM_DRAWERS: Record<
  Exclude<BloomStyle, "none">,
  {
    draw: (c: SkCanvas, cx: number, cy: number, size: number, p: PlantPalette, rng: Rng) => void;
    /** Anzahl und Groesse relativ zum Kronenradius. */
    count: number;
    size: number;
  }
> = {
  cluster: { draw: drawCluster, count: 6, size: 0.28 },
  spike: { draw: drawSpike, count: 8, size: 0.24 },
  rosette: { draw: drawRosette, count: 5, size: 0.3 },
  umbel: { draw: drawUmbel, count: 6, size: 0.3 },
  star: { draw: drawStar, count: 7, size: 0.26 },
};

const drawBlooms = (canvas: SkCanvas, radius: number, style: BloomStyle, palette: PlantPalette, rng: Rng) => {
  if (style === "none" || !palette.bloom) return;
  const spec = BLOOM_DRAWERS[style];
  const step = (Math.PI * 2) / spec.count;
  const phase = rng.range(0, step);
  for (let i = 0; i < spec.count; i++) {
    // Gleichmaessig verteilt mit Streuung -- rein zufaellige Winkel klumpen
    // sichtbar auf einer Seite des Strauchs.
    const angle = phase + i * step + rng.jitter(0, step * 0.4);
    const r = rng.range(radius * 0.12, radius * 0.58);
    spec.draw(canvas, Math.cos(angle) * r, Math.sin(angle) * r, radius * spec.size, palette, rng);
  }
};

const FORM_DRAWERS = {
  mound: drawMound,
  canopy: drawCanopy,
  grass: drawGrass,
  tuft: drawTuft,
} as const;

/**
 * Baut das Bild einer Pflanze. `seed` sollte die Pflanzen-id sein, damit
 * dieselbe Pflanze immer gleich aussieht.
 */
export const createPlantPicture = (species: Species, diameterMeters: number, seed: string): SkPicture => {
  const radius = diameterMeters / 2;
  const rng = makeRng(seed);
  return createPicture(
    (canvas) => {
      // Schlagschatten nach Suedosten -- Licht kommt konventionell von oben links.
      canvas.drawOval(
        Skia.XYWHRect(-radius * 0.9 + radius * 0.12, -radius * 0.82 + radius * 0.2, radius * 1.8, radius * 1.64),
        blurred("#1c2a16", radius * 0.16, 0.28),
      );

      if (species.art.kind !== "procedural") return;
      const { form, bloom, palette } = species.art;
      FORM_DRAWERS[form](canvas, radius, palette, rng);
      drawBlooms(canvas, radius, bloom, palette, rng);
    },
    // Grosszuegiger Aufzeichnungsbereich, damit Schatten und Halme nicht abgeschnitten werden.
    Skia.XYWHRect(-radius * 1.6, -radius * 1.6, radius * 3.2, radius * 3.2),
  );
};
