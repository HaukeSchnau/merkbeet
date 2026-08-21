import {
  ClipOp,
  PaintStyle,
  Skia,
  StrokeCap,
  createPicture,
  type SkCanvas,
  type SkFont,
  type SkPaint,
  type SkPath,
  type SkPathBuilder,
  type SkPicture,
} from "@shopify/react-native-skia";

import { GARDEN_PLAN, SOUTH_WALL_Y, WEST_WALL_X } from "../garden/plan";
import type { GardenArea, Point, Rect } from "../garden/types";
import { makeRng, type Rng } from "./rng";
import { textWidth } from "./text";

/**
 * Der Untergrund: Rasen, Haus, Terrasse und Beeterde. Alles zusammen wird
 * einmal als Skia-Picture aufgezeichnet, weil sich daran nichts ändert.
 * Texturen sind gestreute Vektorprimitive, keine Bilddateien -- damit bleibt
 * der Plan bei jedem Zoomfaktor scharf.
 *
 * Wichtig für die Bildrate: gleichartige Streuung landet in **einem**
 * Sammelpfad und wird mit einem Aufruf gezeichnet. Einzeln gezeichnet kostete
 * derselbe Untergrund über hundert Millisekunden pro Frame, weil Skia pro
 * Aufruf Farbe, Clip und Zustand neu aufsetzt. Weichzeichner sind aus demselben
 * Grund vermieden: ein Maskenfilter wird bei jeder Zoomstufe neu berechnet.
 */

/** Die Materialfarben des Plans. Auch das App-Icon greift darauf zu. */
export const MATERIAL = {
  lawn: { base: "#7fa65f", shade: "#6d9350", blade: "#94b972" },
  house: { base: "#dcd6cc", edge: "#b9b1a4", roof: "#cfc7ba" },
  terrace: { base: "#cdc5b8", joint: "#aca395", tint: "#d6cfc3" },
  soil: { base: "#6b4f3a", dark: "#5a4130", light: "#7d6047", mulch: "#4c3626" },
  edging: "#9a9082",
} as const;

const fill = (color: string, alpha = 1): SkPaint => {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  if (alpha < 1) paint.setAlphaf(alpha);
  return paint;
};

const stroke = (color: string, width: number, alpha = 1): SkPaint => {
  const paint = fill(color, alpha);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(width);
  paint.setStrokeCap(StrokeCap.Round);
  return paint;
};

const pathOf = (area: GardenArea): SkPath =>
  Skia.PathBuilder.Make().addPoly(area.outline, true).detach();

const boundsOf = (area: GardenArea): Rect => {
  const xs = area.outline.map((p) => p.x);
  const ys = area.outline.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

/**
 * Führt `draw` nur innerhalb der Fläche aus. Sparsam einsetzen: solange ein
 * Clip-Pfad aktiv ist, prüft Skia jeden Zeichenaufruf gegen eine Maske und kann
 * nichts mehr über einen billigen Rechteckvergleich verwerfen. Für gestreute
 * Texturen ist `scatterInside` der bessere Weg.
 */
const withinArea = (canvas: SkCanvas, path: SkPath, draw: () => void) => {
  canvas.save();
  canvas.clipPath(path, ClipOp.Intersect, true);
  draw();
  canvas.restore();
};

/** Strahlenschnitt-Test, ob ein Punkt im Umriss liegt. */
const insideOutline = (x: number, y: number, outline: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i];
    const b = outline[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
};

/**
 * Streut Punkte innerhalb eines Umrisses, mit Ablehnung außerhalb. So braucht
 * das Zeichnen keinen Clip-Pfad -- der Vorteil liegt bei der Bildrate, nicht
 * beim Aufzeichnen: Letzteres passiert nur einmal.
 */
const scatterInside = (
  rect: Rect,
  count: number,
  rng: Rng,
  outline: Point[],
  place: (x: number, y: number) => void,
  /**
   * Halbe Ausdehnung der gestreuten Form. Ohne diesen Abstand ragen große
   * Formen über die Kante -- der Clip, der das früher verhindert hat, ist
   * absichtlich weg.
   */
  margin = 0,
) => {
  const fits = (x: number, y: number): boolean => {
    if (!insideOutline(x, y, outline)) return false;
    if (margin === 0) return true;
    return (
      insideOutline(x - margin, y - margin, outline) &&
      insideOutline(x + margin, y - margin, outline) &&
      insideOutline(x - margin, y + margin, outline) &&
      insideOutline(x + margin, y + margin, outline)
    );
  };

  let placed = 0;
  // Obergrenze, damit eine schlecht getroffene Kachel die Aufzeichnung nicht anhält.
  for (let attempt = 0; attempt < count * 8 && placed < count; attempt++) {
    const x = rng.range(rect.x, rect.x + rect.width);
    const y = rng.range(rect.y, rect.y + rect.height);
    if (!fits(x, y)) continue;
    place(x, y);
    placed++;
  }
};

/** Streut `count` Punkte gleichmäßig über ein Rechteck. */
const scatter = (rect: Rect, count: number, rng: Rng, place: (x: number, y: number) => void) => {
  for (let i = 0; i < count; i++) {
    place(rng.range(rect.x, rect.x + rect.width), rng.range(rect.y, rect.y + rect.height));
  }
};

/**
 * Kantenlänge einer Texturkachel in Metern. Kleiner heißt mehr Zeichenaufrufe,
 * aber genaueres Wegwerfen beim Hineinzoomen -- und dort liegt der Engpass.
 */
const TILE = 2;

/**
 * Zerlegt eine Fläche in Kacheln und zeichnet jede für sich.
 *
 * Der Grund ist die Bildrate beim Hineinzoomen: ein einziger Pfad über den
 * ganzen Garten wird von Skia komplett verarbeitet, auch wenn nur ein Bruchteil
 * im Bild ist. Pro Kachel ein Pfad heißt, dass alles außerhalb des Ausschnitts
 * mit einem billigen Rechteckvergleich wegfällt.
 *
 * `density` ist die Streuung pro Quadratmeter, damit alle Kacheln gleich dicht
 * aussehen, egal wie sie am Rand angeschnitten sind.
 */
const perTile = (
  rect: Rect,
  rng: Rng,
  draw: (tile: Rect, count: (density: number) => number) => void,
) => {
  for (let x = rect.x; x < rect.x + rect.width; x += TILE) {
    for (let y = rect.y; y < rect.y + rect.height; y += TILE) {
      const tile: Rect = {
        x,
        y,
        width: Math.min(TILE, rect.x + rect.width - x),
        height: Math.min(TILE, rect.y + rect.height - y),
      };
      const area = tile.width * tile.height;
      draw(tile, (density) => Math.max(1, Math.round(area * density)));
    }
  }
  void rng;
};

/** Sammelt viele gleichartige Formen in einem Pfad. */
const batch = () => Skia.PathBuilder.Make();

const addSegment = (b: SkPathBuilder, x1: number, y1: number, x2: number, y2: number) => {
  b.moveTo(x1, y1).lineTo(x2, y2);
};

const addOval = (b: SkPathBuilder, cx: number, cy: number, rx: number, ry: number) => {
  b.addOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2));
};

const drawLawn = (canvas: SkCanvas, path: SkPath, rect: Rect, rng: Rng) => {
  // Ohne Clip: der Rasen ist die unterste Schicht und deckt die ganze Fläche ab,
  // alles Weitere wird darüber gezeichnet.
  const patches = batch();
  scatter(rect, 30, rng, (x, y) => {
    const r = rng.range(0.9, 2.6);
    addOval(patches, x, y, r, r * rng.range(0.6, 0.9));
  });
  canvas.drawPath(patches.detach(), fill(MATERIAL.lawn.shade, 0.13));

  const blade = stroke(MATERIAL.lawn.blade, 0.022, 0.55);
  perTile(rect, rng, (tile, count) => {
    const blades = batch();
    scatter(tile, count(2.6), rng, (x, y) => {
      const len = rng.range(0.05, 0.11);
      addSegment(blades, x, y, x + rng.range(-0.03, 0.03), y - len);
    });
    canvas.drawPath(blades.detach(), blade);
  });
};

const drawHouse = (canvas: SkCanvas, path: SkPath, rect: Rect) => {
  withinArea(canvas, path, () => {
    // Angedeutetes Dach: Bahnen parallel zur Traufe, alle in einem Pfad.
    const bands = batch();
    for (let y = rect.y; y < rect.y + rect.height; y += 1.1) {
      addSegment(bands, rect.x, y, rect.x + rect.width, y);
    }
    canvas.drawPath(bands.detach(), stroke(MATERIAL.house.roof, 0.06, 0.5));
  });
};

const drawTerrace = (canvas: SkCanvas, path: SkPath, rect: Rect, rng: Rng) => {
  // Die Terrasse ist ein Rechteck; die Plattenraster passen exakt hinein,
  // ein Clip wäre nur Kosten.
  {
    const tile = 0.6;
    // Leicht getönte Platten wirken lebendiger als ein reines Raster. Zwei
    // Helligkeitsstufen, damit es bei einem Pfad pro Stufe bleibt.
    const light = batch();
    const dark = batch();
    for (let x = rect.x; x < rect.x + rect.width; x += tile) {
      for (let y = rect.y; y < rect.y + rect.height; y += tile) {
        const roll = rng.next();
        if (roll > 0.72) light.addRect(Skia.XYWHRect(x, y, tile, tile));
        else if (roll > 0.45) dark.addRect(Skia.XYWHRect(x, y, tile, tile));
      }
    }
    canvas.drawPath(light.detach(), fill(MATERIAL.terrace.tint, 0.4));
    canvas.drawPath(dark.detach(), fill(MATERIAL.terrace.tint, 0.18));

    const joints = batch();
    for (let x = rect.x; x <= rect.x + rect.width + 0.001; x += tile) {
      addSegment(joints, x, rect.y, x, rect.y + rect.height);
    }
    for (let y = rect.y; y <= rect.y + rect.height + 0.001; y += tile) {
      addSegment(joints, rect.x, y, rect.x + rect.width, y);
    }
    canvas.drawPath(joints.detach(), stroke(MATERIAL.terrace.joint, 0.022, 0.75));
  }
};

const drawBed = (canvas: SkCanvas, path: SkPath, rect: Rect, rng: Rng, outline: Point[]) => {
  const clodDark = fill(MATERIAL.soil.dark, 0.3);
  const clodLight = fill(MATERIAL.soil.light, 0.3);
  const gritPaint = fill(MATERIAL.soil.light, 0.4);
  const mulchPaint = stroke(MATERIAL.soil.mulch, 0.03, 0.5);

  perTile(rect, rng, (tile, count) => {
    const clodsDark = batch();
    const clodsLight = batch();
    scatterInside(
      tile,
      count(1.2),
      rng,
      outline,
      (x, y) => {
        const target = rng.next() > 0.5 ? clodsDark : clodsLight;
        addOval(target, x, y, rng.range(0.12, 0.35), rng.range(0.09, 0.22));
      },
      0.35,
    );
    canvas.drawPath(clodsDark.detach(), clodDark);
    canvas.drawPath(clodsLight.detach(), clodLight);

    const grit = batch();
    // Bewusst dünner und etwas größer: bei starkem Zoom waren die Körner ein
    // bis drei Pixel groß, also kaum mehr als Rauschen -- kosteten aber den
    // größten Teil der Texturzeit.
    scatterInside(tile, count(4), rng, outline, (x, y) => {
      const r = rng.range(0.015, 0.032);
      addOval(grit, x, y, r, r);
    }, 0.04);
    canvas.drawPath(grit.detach(), gritPaint);

    // Mulch als kurze dicke Striche: als Pfad billiger als gedrehte Ovale.
    const mulch = batch();
    scatterInside(tile, count(1.6), rng, outline, (x, y) => {
      const angle = rng.range(0, Math.PI);
      const half = 0.045;
      addSegment(
        mulch,
        x - Math.cos(angle) * half,
        y - Math.sin(angle) * half,
        x + Math.cos(angle) * half,
        y + Math.sin(angle) * half,
      );
    }, 0.07);
    canvas.drawPath(mulch.detach(), mulchPaint);
  });
  void path;
};

/**
 * Schlagschatten von Haus- und Terrassenwand auf das Beet.
 *
 * Beide Bänder liegen durch die Beetgeometrie zwangsläufig innerhalb des
 * Beetes, deshalb ohne Clip -- ein L-förmiger Clip über riesige Rechtecke war
 * der zweitteuerste Posten des ganzen Untergrunds. Als Treppe aus wenigen
 * Bändern statt als Weichzeichner, das ist optisch kaum zu unterscheiden.
 */
const drawWallShadow = (canvas: SkCanvas, bedRight: number, bedBottom: number) => {
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const depth = 0.5 * (1 - i / steps);
    const bands = batch();
    // Entlang der Südwand von Terrasse und Haus.
    bands.addRect(
      Skia.XYWHRect(WEST_WALL_X, SOUTH_WALL_Y, bedRight - WEST_WALL_X, Math.min(depth, bedBottom - SOUTH_WALL_Y)),
    );
    // Entlang der Westwand der Terrasse, in den Westarm hinein.
    bands.addRect(Skia.XYWHRect(WEST_WALL_X - depth, 0, depth, SOUTH_WALL_Y));
    canvas.drawPath(bands.detach(), fill("#1c2a16", 0.05));
  }
};

/**
 * Schrift in Weltkoordinaten. Die Schrift kommt in gewöhnlicher Pixelgröße
 * und wird über die Matrix auf `heightMeters` verkleinert. Eine Schrift direkt
 * in Metern zu setzen funktioniert nicht: bei Größen unter 1 vermisst Skia
 * die Glyphen falsch und lässt Buchstaben ausfallen.
 */
const drawWorldText = (
  canvas: SkCanvas,
  font: SkFont,
  text: string,
  x: number,
  y: number,
  heightMeters: number,
  paint: SkPaint,
  align: "left" | "center" | "right" = "left",
) => {
  const metersPerUnit = heightMeters / font.getSize();
  const width = textWidth(font, text) * metersPerUnit;
  const offset = align === "center" ? -width / 2 : align === "right" ? -width : 0;
  canvas.save();
  canvas.translate(x + offset, y);
  canvas.scale(metersPerUnit, metersPerUnit);
  canvas.drawText(text, 0, 0, paint, font);
  canvas.restore();
};

/**
 * Maßstabsleiste auf dem Rasen: fünf Meter in abwechselnden Segmenten. Sie
 * gehört zum Plan und skaliert deshalb mit ihm, wie bei einer Zeichnung.
 */
const drawScaleBar = (canvas: SkCanvas, font: SkFont, x: number, y: number) => {
  const meters = 5;
  const height = 0.16;
  const dark = batch();
  const light = batch();
  for (let i = 0; i < meters; i++) {
    (i % 2 === 0 ? dark : light).addRect(Skia.XYWHRect(x + i, y, 1, height));
  }
  canvas.drawPath(dark.detach(), fill("#3f3a33", 0.85));
  canvas.drawPath(light.detach(), fill("#f4f1e8", 0.85));
  canvas.drawRect(Skia.XYWHRect(x, y, meters, height), stroke("#3f3a33", 0.02, 0.85));
  const ink = fill("#3f3a33", 0.8);
  drawWorldText(canvas, font, "0", x, y - 0.1, 0.3, ink);
  drawWorldText(canvas, font, `${meters} m`, x + meters, y - 0.1, 0.3, ink, "right");
};

/** Flächenbeschriftung, damit Haus und Terrasse auch ohne Etiketten lesbar sind. */
const drawAreaLabel = (canvas: SkCanvas, font: SkFont, text: string, cx: number, cy: number) => {
  drawWorldText(canvas, font, text, cx, cy, 0.36, fill("#5d564c", 0.55), "center");
};

const BASE_COLOR: Record<GardenArea["kind"], string> = {
  lawn: MATERIAL.lawn.base,
  house: MATERIAL.house.base,
  terrace: MATERIAL.terrace.base,
  bed: MATERIAL.soil.base,
};

const DRAWERS: Record<
  GardenArea["kind"],
  (c: SkCanvas, p: SkPath, r: Rect, rng: Rng, outline: Point[]) => void
> = {
  lawn: drawLawn,
  house: (c, p, r) => drawHouse(c, p, r),
  terrace: drawTerrace,
  bed: drawBed,
};

/** Umriss und Kante einer Fläche, soweit sie eine hat. */
const drawAreaEdge = (canvas: SkCanvas, area: GardenArea, path: SkPath) => {
  if (area.kind === "house") canvas.drawPath(path, stroke(MATERIAL.house.edge, 0.09));
  if (area.kind === "terrace") canvas.drawPath(path, stroke(MATERIAL.terrace.joint, 0.06));
  if (area.kind === "bed") canvas.drawPath(path, stroke(MATERIAL.edging, 0.07, 0.9));
};

/**
 * Der Untergrund ohne Textur: nur Flächen und Kanten. Für die Übersicht, wo
 * der ganze Garten im Bild ist und die Textur zu klein wäre, um etwas
 * beizutragen -- aber am meisten kosten würde.
 */
export const createGroundFlatPicture = (): SkPicture => {
  const { bounds, areas } = GARDEN_PLAN;
  return createPicture(
    (canvas) => {
      for (const area of areas) {
        const path = pathOf(area);
        canvas.drawPath(path, fill(BASE_COLOR[area.kind]));
        drawAreaEdge(canvas, area, path);
      }
    },
    Skia.XYWHRect(bounds.x, bounds.y, bounds.width, bounds.height),
  );
};

/**
 * Der Untergrund mit Textur. Ersetzt `createGroundFlatPicture` beim
 * Hineinzoomen -- die beiden schließen sich aus, damit die Reihenfolge stimmt:
 * jede Fläche deckt erst die Textur der darunterliegenden ab und trägt dann
 * ihre eigene auf.
 */
export const createGroundTexturePicture = (): SkPicture => {
  const { bounds, areas } = GARDEN_PLAN;
  return createPicture(
    (canvas) => {
      const bed = areas.find((area) => area.kind === "bed");
      for (const area of areas) {
        const path = pathOf(area);
        canvas.drawPath(path, fill(BASE_COLOR[area.kind]));
        DRAWERS[area.kind](canvas, path, boundsOf(area), makeRng(`ground:${area.id}`), area.outline);
        if (area.kind === "bed") {
          const r = boundsOf(area);
          drawWallShadow(canvas, r.x + r.width, r.y + r.height);
        }
        drawAreaEdge(canvas, area, path);
      }
      void bed;
    },
    Skia.XYWHRect(bounds.x, bounds.y, bounds.width, bounds.height),
  );
};

/**
 * Beschriftung und Maßstabsleiste. Getrennt, weil sie über beiden
 * Untergrundvarianten liegen müssen.
 */
export const createGroundAnnotationsPicture = (font: SkFont | null): SkPicture => {
  const { bounds, areas } = GARDEN_PLAN;
  return createPicture(
    (canvas) => {
      if (!font) return;
      const house = areas.find((area) => area.kind === "house");
      const terrace = areas.find((area) => area.kind === "terrace");
      if (house) {
        const r = boundsOf(house);
        drawAreaLabel(canvas, font, "HAUS", r.x + r.width * 0.72, r.y + r.height * 0.35);
      }
      if (terrace) {
        const r = boundsOf(terrace);
        drawAreaLabel(canvas, font, "TERRASSE", r.x + r.width / 2, r.y + r.height / 2);
      }
      drawScaleBar(canvas, font, 0.4, bounds.y + bounds.height - 1.1);
    },
    Skia.XYWHRect(bounds.x, bounds.y, bounds.width, bounds.height),
  );
};
