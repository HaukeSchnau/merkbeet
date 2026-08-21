import {
  BlurStyle,
  ClipOp,
  PaintStyle,
  Skia,
  StrokeCap,
  createPicture,
  type SkCanvas,
  type SkPaint,
  type SkFont,
  type SkPath,
  type SkPicture,
} from "@shopify/react-native-skia";

import { GARDEN_PLAN, SOUTH_WALL_Y, WEST_WALL_X } from "../garden/plan";
import type { GardenArea, Rect } from "../garden/types";
import { makeRng, type Rng } from "./rng";
import { textWidth } from "./text";

/**
 * Der Untergrund: Rasen, Haus, Terrasse und Beeterde. Alles zusammen wird
 * einmal als Skia-Picture aufgezeichnet, weil sich daran nichts aendert.
 * Texturen sind gestreute Vektorprimitive, keine Bilddateien -- damit bleibt
 * der Plan bei jedem Zoomfaktor scharf.
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

const linePath = (x1: number, y1: number, x2: number, y2: number): SkPath =>
  Skia.PathBuilder.Make().moveTo(x1, y1).lineTo(x2, y2).detach();

const boundsOf = (area: GardenArea): Rect => {
  const xs = area.outline.map((p) => p.x);
  const ys = area.outline.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

/** Fuehrt `draw` nur innerhalb der Flaeche aus, damit Texturen nicht ueberlaufen. */
const withinArea = (canvas: SkCanvas, path: SkPath, draw: () => void) => {
  canvas.save();
  canvas.clipPath(path, ClipOp.Intersect, true);
  draw();
  canvas.restore();
};

/** Streut `count` Punkte gleichmaessig ueber ein Rechteck. */
const scatter = (rect: Rect, count: number, rng: Rng, place: (x: number, y: number, i: number) => void) => {
  for (let i = 0; i < count; i++) {
    place(rng.range(rect.x, rect.x + rect.width), rng.range(rect.y, rect.y + rect.height), i);
  }
};

const drawLawn = (canvas: SkCanvas, path: SkPath, rect: Rect, rng: Rng) => {
  canvas.drawPath(path, fill(MATERIAL.lawn.base));
  withinArea(canvas, path, () => {
    // Weiche, dunklere Flecken geben dem Rasen Tiefe.
    scatter(rect, 26, rng, (x, y) => {
      const r = rng.range(0.8, 2.4);
      canvas.drawCircle(x, y, r, (() => {
        const paint = fill(MATERIAL.lawn.shade, 0.22);
        paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, r * 0.5, true));
        return paint;
      })());
    });
    const blade = stroke(MATERIAL.lawn.blade, 0.022, 0.55);
    scatter(rect, 2600, rng, (x, y) => {
      const len = rng.range(0.05, 0.11);
      const lean = rng.range(-0.03, 0.03);
      canvas.drawPath(linePath(x, y, x + lean, y - len), blade);
    });
  });
};

const drawHouse = (canvas: SkCanvas, path: SkPath, rect: Rect) => {
  canvas.drawPath(path, fill(MATERIAL.house.base));
  withinArea(canvas, path, () => {
    // Angedeutetes Dach: ein paar breite Bahnen parallel zur Traufe.
    const band = stroke(MATERIAL.house.roof, 0.06, 0.5);
    for (let y = rect.y; y < rect.y + rect.height; y += 1.1) {
      canvas.drawPath(linePath(rect.x, y, rect.x + rect.width, y), band);
    }
  });
  canvas.drawPath(path, stroke(MATERIAL.house.edge, 0.09));
};

const drawTerrace = (canvas: SkCanvas, path: SkPath, rect: Rect, rng: Rng) => {
  canvas.drawPath(path, fill(MATERIAL.terrace.base));
  withinArea(canvas, path, () => {
    const tile = 0.6;
    // Leicht unterschiedlich getoente Platten wirken lebendiger als ein Raster.
    for (let x = rect.x; x < rect.x + rect.width; x += tile) {
      for (let y = rect.y; y < rect.y + rect.height; y += tile) {
        if (rng.next() > 0.55) {
          canvas.drawRect(
            Skia.XYWHRect(x, y, tile, tile),
            fill(MATERIAL.terrace.tint, rng.range(0.15, 0.45)),
          );
        }
      }
    }
    const joint = stroke(MATERIAL.terrace.joint, 0.022, 0.75);
    for (let x = rect.x; x <= rect.x + rect.width + 0.001; x += tile) {
      canvas.drawPath(linePath(x, rect.y, x, rect.y + rect.height), joint);
    }
    for (let y = rect.y; y <= rect.y + rect.height + 0.001; y += tile) {
      canvas.drawPath(linePath(rect.x, y, rect.x + rect.width, y), joint);
    }
  });
  canvas.drawPath(path, stroke(MATERIAL.terrace.joint, 0.06));
};

const drawBed = (canvas: SkCanvas, path: SkPath, rect: Rect, rng: Rng) => {
  canvas.drawPath(path, fill(MATERIAL.soil.base));
  withinArea(canvas, path, () => {
    // Grobe Erdschollen, danach feine Koernung und Mulchstuecke.
    scatter(rect, 90, rng, (x, y) => {
      canvas.drawOval(
        Skia.XYWHRect(x, y, rng.range(0.25, 0.7), rng.range(0.18, 0.45)),
        fill(rng.next() > 0.5 ? MATERIAL.soil.dark : MATERIAL.soil.light, 0.3),
      );
    });
    scatter(rect, 1700, rng, (x, y) => {
      canvas.drawCircle(x, y, rng.range(0.008, 0.024), fill(rng.next() > 0.5 ? MATERIAL.soil.dark : MATERIAL.soil.light, 0.55));
    });
    const mulch = fill(MATERIAL.soil.mulch, 0.5);
    scatter(rect, 260, rng, (x, y) => {
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(rng.range(0, 180), 0, 0);
      canvas.drawOval(Skia.XYWHRect(-0.045, -0.014, 0.09, 0.028), mulch);
      canvas.restore();
    });
  });
  canvas.drawPath(path, stroke(MATERIAL.edging, 0.07, 0.9));
};

/** Schlagschatten von Haus- und Terrassenwand auf das Beet. */
const drawWallShadow = (canvas: SkCanvas, bedPath: SkPath) => {
  withinArea(canvas, bedPath, () => {
    const paint = fill("#1c2a16", 0.16);
    paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 0.22, true));
    // Suedwand von Terrasse und Haus
    canvas.drawRect(Skia.XYWHRect(WEST_WALL_X, SOUTH_WALL_Y, 40, 0.42), paint);
    // Westwand der Terrasse, die in den Westarm faellt
    canvas.drawRect(Skia.XYWHRect(WEST_WALL_X - 0.42, -1, 0.42, SOUTH_WALL_Y + 1), paint);
  });
};

/**
 * Schrift in Weltkoordinaten. Die Schrift kommt in gewoehnlicher Pixelgroesse
 * und wird ueber die Matrix auf `heightMeters` verkleinert. Eine Schrift direkt
 * in Metern zu setzen funktioniert nicht: bei Groessen unter 1 vermisst Skia
 * die Glyphen falsch und laesst Buchstaben ausfallen.
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
 * Massstabsleiste auf dem Rasen: fuenf Meter in abwechselnden Segmenten. Sie
 * gehoert zum Plan und skaliert deshalb mit ihm, wie bei einer Zeichnung.
 */
const drawScaleBar = (canvas: SkCanvas, font: SkFont, x: number, y: number) => {
  const meters = 5;
  const height = 0.16;
  for (let i = 0; i < meters; i++) {
    canvas.drawRect(
      Skia.XYWHRect(x + i, y, 1, height),
      fill(i % 2 === 0 ? "#3f3a33" : "#f4f1e8", 0.85),
    );
  }
  canvas.drawRect(Skia.XYWHRect(x, y, meters, height), stroke("#3f3a33", 0.02, 0.85));
  const ink = fill("#3f3a33", 0.8);
  drawWorldText(canvas, font, "0", x, y - 0.1, 0.3, ink);
  drawWorldText(canvas, font, `${meters} m`, x + meters, y - 0.1, 0.3, ink, "right");
};

/** Flaechenbeschriftung, damit Haus und Terrasse auch ohne Etiketten lesbar sind. */
const drawAreaLabel = (canvas: SkCanvas, font: SkFont, text: string, cx: number, cy: number) => {
  drawWorldText(canvas, font, text, cx, cy, 0.36, fill("#5d564c", 0.55), "center");
};

const DRAWERS: Record<GardenArea["kind"], (c: SkCanvas, p: SkPath, r: Rect, rng: Rng) => void> = {
  lawn: drawLawn,
  house: (c, p, r) => drawHouse(c, p, r),
  terrace: drawTerrace,
  bed: drawBed,
};

/**
 * Zeichnet den kompletten Untergrund. Reihenfolge der Flaechen im Plan =
 * Zeichenreihenfolge. `font` ist eine Schrift in gewoehnlicher Pixelgroesse;
 * fehlt sie, bleiben nur die Beschriftungen weg.
 */
export const createGroundPicture = (font: SkFont | null): SkPicture => {
  const { bounds, areas } = GARDEN_PLAN;
  return createPicture(
    (canvas) => {
      const bed = areas.find((area) => area.kind === "bed");
      for (const area of areas) {
        const path = pathOf(area);
        DRAWERS[area.kind](canvas, path, boundsOf(area), makeRng(`ground:${area.id}`));
      }
      if (bed) drawWallShadow(canvas, pathOf(bed));
      if (font) {
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
      }
    },
    Skia.XYWHRect(bounds.x, bounds.y, bounds.width, bounds.height),
  );
};
