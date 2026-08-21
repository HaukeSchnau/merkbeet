import {
  PaintStyle,
  Skia,
  StrokeCap,
  createPicture,
  type SkCanvas,
  type SkPaint,
  type SkPath,
  type SkPathBuilder,
  type SkPicture,
} from "@shopify/react-native-skia";

import type { BloomStyle, PlantPalette, Species } from "../garden/species";
import { makeRng, type Rng } from "./rng";

/**
 * Zeichnet eine Pflanze von oben als Skia-Picture, in Metern und zentriert auf
 * (0, 0). Ein Picture ist ein aufgezeichneter Vektor-Befehlssatz: einmal
 * erzeugt, bleibt es bei jedem Zoom scharf und wird pro Frame nur abgespielt.
 *
 * Entscheidend für die Bildrate: gleichfarbige Formen kommen über
 * `addPath(form, matrix)` in **einen** Pfad und werden mit einem Aufruf
 * gezeichnet. Blatt für Blatt gezeichnet kostete eine Pflanze rund fünfzig
 * Aufrufe; bei 25 Pflanzen war das der halbe Frame. Weichzeichner sind aus
 * demselben Grund vermieden -- ein Maskenfilter wird bei jeder Zoomstufe neu
 * berechnet.
 */

const fill = (color: string, alpha = 1): SkPaint => {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  if (alpha < 1) paint.setAlphaf(alpha);
  return paint;
};

/** Einheitsform: Oval mit Länge 1 und Breite 1, zentriert. Wird nur skaliert. */
const UNIT_OVAL: SkPath = Skia.PathBuilder.Make().addOval(Skia.XYWHRect(-0.5, -0.5, 1, 1)).detach();

const batch = () => Skia.PathBuilder.Make();

/**
 * Hängt ein gedrehtes Oval an den Sammelpfad. Der Umweg über eine Matrix hält
 * die Form exakt -- ein selbst gerechnetes Mandelblatt sähe anders aus.
 */
const addOval = (
  b: SkPathBuilder,
  x: number,
  y: number,
  width: number,
  length: number,
  angleDeg: number,
) => {
  const matrix = Skia.Matrix();
  matrix.translate(x, y);
  matrix.rotate((angleDeg * Math.PI) / 180);
  matrix.scale(width, length);
  b.addPath(UNIT_OVAL, matrix);
};

const addCircle = (b: SkPathBuilder, cx: number, cy: number, r: number) => {
  b.addOval(Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2));
};

/**
 * Ein Blattkranz: `count` Blätter auf einem Ring, jeweils nach außen zeigend.
 * Zusammengesetzt ergeben die Ringe die Kuppelform des Strauchs.
 */
const addLeafRing = (
  b: SkPathBuilder,
  radius: number,
  count: number,
  leafLength: number,
  leafWidth: number,
  rng: Rng,
) => {
  const step = 360 / count;
  const phase = rng.range(0, step);
  for (let i = 0; i < count; i++) {
    const angle = phase + i * step + rng.jitter(0, step * 0.35);
    const rad = (angle * Math.PI) / 180;
    const r = rng.jitter(radius, radius * 0.12);
    addOval(
      b,
      Math.cos(rad) * r,
      Math.sin(rad) * r,
      rng.jitter(leafWidth, leafWidth * 0.18),
      rng.jitter(leafLength, leafLength * 0.18),
      angle + 90,
    );
  }
};

/** Dichter, runder Strauch: außen dunkel, innen hell -- liest sich als Kuppel. */
const drawMound = (canvas: SkCanvas, radius: number, palette: PlantPalette, rng: Rng) => {
  // Grundmasse, damit zwischen den Blättern kein Boden durchscheint.
  const base = batch();
  addCircle(base, 0, 0, radius * 0.78);
  canvas.drawPath(base.detach(), fill(palette.leafDark));

  const rings: Array<{ r: number; count: number; color: string; leaf: number }> = [
    { r: radius * 0.88, count: 16, color: palette.leafTip ?? palette.leafDark, leaf: 0.5 },
    { r: radius * 0.64, count: 13, color: palette.leafDark, leaf: 0.48 },
    { r: radius * 0.4, count: 10, color: palette.leafMid, leaf: 0.44 },
    { r: radius * 0.16, count: 7, color: palette.leafLight, leaf: 0.4 },
  ];
  for (const ring of rings) {
    const b = batch();
    addLeafRing(b, ring.r, ring.count, radius * ring.leaf, radius * ring.leaf * 0.62, rng);
    canvas.drawPath(b.detach(), fill(ring.color));
  }
};

/** Größeres Gehölz: lockerere, größere Blattlappen und ein Stammansatz. */
const drawCanopy = (canvas: SkCanvas, radius: number, palette: PlantPalette, rng: Rng) => {
  const base = batch();
  addCircle(base, 0, 0, radius * 0.7);
  canvas.drawPath(base.detach(), fill(palette.leafDark, 0.9));

  const rings: Array<{ r: number; count: number; color: string }> = [
    { r: radius * 0.92, count: 11, color: palette.leafDark },
    { r: radius * 0.68, count: 9, color: palette.leafMid },
    { r: radius * 0.42, count: 7, color: palette.leafMid },
    { r: radius * 0.2, count: 5, color: palette.leafLight },
  ];
  for (const ring of rings) {
    const b = batch();
    addLeafRing(b, ring.r, ring.count, radius * 0.62, radius * 0.42, rng);
    canvas.drawPath(b.detach(), fill(ring.color));
  }
  // Stamm blitzt in der Mitte durch die Krone.
  const trunk = batch();
  addCircle(trunk, rng.jitter(0, radius * 0.05), rng.jitter(0, radius * 0.05), radius * 0.09);
  canvas.drawPath(trunk.detach(), fill("#5b4432", 0.75));
};

/** Ziergras: einzelne Halme, die vom Horst nach außen kippen. */
const drawGrass = (canvas: SkCanvas, radius: number, palette: PlantPalette, rng: Rng) => {
  const colors = [palette.leafDark, palette.leafMid, palette.leafLight];
  const groups = colors.map(() => batch());
  for (let i = 0; i < 34; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const length = rng.range(radius * 0.55, radius * 1.05);
    const bend = rng.range(-0.35, 0.35);
    const group = groups[i % groups.length];
    group
      .moveTo(0, 0)
      .quadTo(
        Math.cos(angle) * length * 0.55,
        Math.sin(angle) * length * 0.55,
        Math.cos(angle + bend) * length,
        Math.sin(angle + bend) * length,
      );
  }
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeCap(StrokeCap.Round);
  paint.setStrokeWidth(radius * 0.07);
  groups.forEach((group, index) => {
    paint.setColor(Skia.Color(colors[index]));
    canvas.drawPath(group.detach(), paint);
  });
  const heart = batch();
  addCircle(heart, 0, 0, radius * 0.18);
  canvas.drawPath(heart.detach(), fill(palette.leafDark, 0.85));
};

/** Niedriges Polster, z.B. Lavendel: silbriges Kissen aus kurzen Trieben. */
const drawTuft = (canvas: SkCanvas, radius: number, palette: PlantPalette, rng: Rng) => {
  const base = batch();
  addCircle(base, 0, 0, radius * 0.72);
  canvas.drawPath(base.detach(), fill(palette.leafDark));

  const outer = batch();
  addLeafRing(outer, radius * 0.62, 14, radius * 0.5, radius * 0.2, rng);
  canvas.drawPath(outer.detach(), fill(palette.leafMid));

  const inner = batch();
  addLeafRing(inner, radius * 0.3, 9, radius * 0.42, radius * 0.18, rng);
  canvas.drawPath(inner.detach(), fill(palette.leafLight));
};

/**
 * Blüten. Jede Art sammelt Blütenblätter und Mitte in je einem Pfad, damit pro
 * Pflanze zwei Aufrufe genügen statt einem pro Kreis.
 */
type BloomAdder = (
  petals: SkPathBuilder,
  cores: SkPathBuilder,
  cx: number,
  cy: number,
  size: number,
  rng: Rng,
) => void;

/** Blütenkugel aus mehreren kleinen Kreisen -- Hortensie, Schneeball. */
const addCluster: BloomAdder = (petals, cores, cx, cy, size, rng) => {
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2 + rng.range(0, 0.6);
    addCircle(petals, cx + Math.cos(angle) * size * 0.5, cy + Math.sin(angle) * size * 0.5, size * 0.42);
  }
  addCircle(cores, cx, cy, size * 0.45);
};

/** Aufrechte Blütenrispe von oben: länglicher, sich verjüngender Kegel. */
const addSpike: BloomAdder = (petals, cores, cx, cy, size, rng) => {
  const angle = rng.range(0, 360);
  addOval(petals, cx, cy, size * 0.68, size * 1.7, angle);
  addOval(cores, cx, cy, size * 0.4, size * 1.1, angle);
};

/** Einzelne gefüllte Blüte -- Rose. */
const addRosette: BloomAdder = (petals, cores, cx, cy, size, rng) => {
  const phase = rng.range(0, Math.PI);
  for (let i = 0; i < 5; i++) {
    const angle = phase + (i / 5) * Math.PI * 2;
    addCircle(petals, cx + Math.cos(angle) * size * 0.42, cy + Math.sin(angle) * size * 0.42, size * 0.46);
  }
  addCircle(cores, cx, cy, size * 0.36);
};

/** Flache Blütendolde -- Spiere. */
const addUmbel: BloomAdder = (petals, _cores, cx, cy, size, rng) => {
  for (let i = 0; i < 11; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const r = rng.range(0, size * 0.62);
    addCircle(petals, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, size * 0.2);
  }
};

/** Sternförmige Einzelblüte -- Sternmagnolie. */
const addStarBloom: BloomAdder = (petals, cores, cx, cy, size, rng) => {
  const phase = rng.range(0, 360);
  for (let i = 0; i < 8; i++) {
    const angle = phase + i * 45;
    const rad = (angle * Math.PI) / 180;
    addOval(
      petals,
      cx + Math.sin(rad) * size * 0.45,
      cy - Math.cos(rad) * size * 0.45,
      size * 0.2,
      size * 0.9,
      angle,
    );
  }
  addCircle(cores, cx, cy, size * 0.18);
};

const BLOOMS: Record<Exclude<BloomStyle, "none">, { add: BloomAdder; count: number; size: number }> = {
  cluster: { add: addCluster, count: 6, size: 0.28 },
  spike: { add: addSpike, count: 8, size: 0.24 },
  rosette: { add: addRosette, count: 5, size: 0.3 },
  umbel: { add: addUmbel, count: 6, size: 0.3 },
  star: { add: addStarBloom, count: 7, size: 0.26 },
};

const drawBlooms = (canvas: SkCanvas, radius: number, style: BloomStyle, palette: PlantPalette, rng: Rng) => {
  if (style === "none" || !palette.bloom) return;
  const spec = BLOOMS[style];
  const petals = batch();
  const cores = batch();
  const step = (Math.PI * 2) / spec.count;
  const phase = rng.range(0, step);
  for (let i = 0; i < spec.count; i++) {
    // Gleichmäßig verteilt mit Streuung -- rein zufällige Winkel klumpen
    // sichtbar auf einer Seite des Strauchs.
    const angle = phase + i * step + rng.jitter(0, step * 0.4);
    const r = rng.range(radius * 0.12, radius * 0.58);
    spec.add(petals, cores, Math.cos(angle) * r, Math.sin(angle) * r, radius * spec.size, rng);
  }
  canvas.drawPath(petals.detach(), fill(palette.bloom));
  canvas.drawPath(cores.detach(), fill(palette.bloomCore ?? palette.bloom));
};

/**
 * Sternförmige Einzelblüte, freistehend -- wird vom App-Icon benutzt, damit
 * dort dieselbe Blütenform steht wie im Plan.
 */
export const drawStar = (
  canvas: SkCanvas,
  cx: number,
  cy: number,
  size: number,
  palette: PlantPalette,
  rng: Rng,
) => {
  const petals = batch();
  const cores = batch();
  addStarBloom(petals, cores, cx, cy, size, rng);
  canvas.drawPath(petals.detach(), fill(palette.bloom ?? "#ffffff"));
  canvas.drawPath(cores.detach(), fill(palette.bloomCore ?? "#f0dfc8"));
};

const FORMS = {
  mound: drawMound,
  canopy: drawCanopy,
  grass: drawGrass,
  tuft: drawTuft,
} as const;

/**
 * Schlagschatten nach Südosten -- Licht kommt konventionell von oben links.
 * Drei gestapelte Ellipsen statt eines Weichzeichners: derselbe Eindruck,
 * ohne pro Zoomstufe neu berechnete Maske.
 */
const drawShadow = (canvas: SkCanvas, radius: number) => {
  const offsetX = radius * 0.12;
  const offsetY = radius * 0.2;
  for (const [spread, alpha] of [
    [1.02, 0.08],
    [0.92, 0.09],
    [0.8, 0.1],
  ] as const) {
    const b = batch();
    addOval(b, offsetX, offsetY, radius * 1.8 * spread, radius * 1.64 * spread, 0);
    canvas.drawPath(b.detach(), fill("#1c2a16", alpha));
  }
};

/**
 * Baut das Bild einer Pflanze. `seed` sollte die Pflanzen-id sein, damit
 * dieselbe Pflanze immer gleich aussieht.
 */
export const createPlantPicture = (species: Species, diameterMeters: number, seed: string): SkPicture => {
  const radius = diameterMeters / 2;
  const rng = makeRng(seed);
  return createPicture(
    (canvas) => {
      drawShadow(canvas, radius);
      if (species.art.kind !== "procedural") return;
      const { form, bloom, palette } = species.art;
      FORMS[form](canvas, radius, palette, rng);
      drawBlooms(canvas, radius, bloom, palette, rng);
    },
    // Großzügiger Aufzeichnungsbereich, damit Schatten und Halme nicht abgeschnitten werden.
    Skia.XYWHRect(-radius * 1.6, -radius * 1.6, radius * 3.2, radius * 3.2),
  );
};
