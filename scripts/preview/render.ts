/**
 * Rendert den Plan und eine Artentafel als PNG, damit sich die prozedurale
 * Grafik ohne Geraet oder Emulator beurteilen laesst.
 *
 *   bun run preview
 */
import { GARDEN_PLAN } from "../../src/garden/plan";
import { SPECIES_IDS, speciesOf } from "../../src/garden/species";
import {
  createGroundAnnotationsPicture,
  createGroundFlatPicture,
  createGroundTexturePicture,
} from "../../src/view/ground";
import { createPlantPicture } from "../../src/view/plantArt";
import type { SkCanvas } from "@shopify/react-native-skia";

import { Skia } from "./skia-node";

const OUT_DIR = new URL("../../docs/preview/", import.meta.url);

const loadFont = async (sizeInUnits: number) => {
  const bytes = new Uint8Array(
    await Bun.file("node_modules/@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf").arrayBuffer(),
  );
  const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(bytes));
  if (!typeface) throw new Error("Schrift konnte nicht geladen werden");
  return Skia.Font(typeface, sizeInUnits);
};

const writePng = async (
  name: string,
  width: number,
  height: number,
  draw: (canvas: SkCanvas) => void,
) => {
  const surface = Skia.Surface.Make(width, height);
  if (!surface) throw new Error("Surface konnte nicht erzeugt werden");
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color("#ffffff"));
  draw(canvas);
  surface.flush();
  const image = surface.makeImageSnapshot();
  const bytes = image.encodeToBytes();
  if (!bytes) throw new Error("PNG konnte nicht kodiert werden");
  await Bun.write(new URL(name, OUT_DIR), bytes);
  console.log(`${name}  ${width}x${height}`);
};

/** Der ganze Plan von oben, wie ihn die App in der Uebersicht zeigt. */
const renderPlan = async (pixelsPerMeter: number, withTexture = true) => {
  const { bounds, plants } = GARDEN_PLAN;
  const width = Math.round(bounds.width * pixelsPerMeter);
  const height = Math.round(bounds.height * pixelsPerMeter);
  const worldFont = await loadFont(14);
  const labelFont = await loadFont(14);
  const groundFlat = createGroundFlatPicture();
  const groundTexture = createGroundTexturePicture();
  const groundAnnotations = createGroundAnnotationsPicture(worldFont);

  await writePng(`plan-${pixelsPerMeter}px.png`, width, height, (canvas) => {
    canvas.save();
    canvas.scale(pixelsPerMeter, pixelsPerMeter);
    canvas.translate(-bounds.x, -bounds.y);
    canvas.drawPicture(withTexture ? groundTexture : groundFlat);
    canvas.drawPicture(groundAnnotations);
    for (const plant of [...plants].sort((a, b) => a.position.y - b.position.y)) {
      const species = speciesOf(plant.speciesId);
      const picture = createPlantPicture(
        species,
        plant.diameterMeters ?? species.defaultDiameterMeters,
        plant.id,
      );
      canvas.save();
      canvas.translate(plant.position.x, plant.position.y);
      canvas.drawPicture(picture);
      canvas.restore();
    }
    canvas.restore();

    // Etiketten wie in der App: konstante Groesse in Bildschirmpixeln.
    const ink = Skia.Paint();
    ink.setColor(Skia.Color("#3b352c"));
    const backdrop = Skia.Paint();
    backdrop.setColor(Skia.Color("#fffdf6"));
    backdrop.setAlphaf(0.92);
    for (const plant of plants) {
      const species = speciesOf(plant.speciesId);
      const text = plant.name ?? species.name;
      const textW = labelFont
        .getGlyphWidths(labelFont.getGlyphIDs(text))
        .reduce((total, w) => total + w, 0);
      const radius = (plant.diameterMeters ?? species.defaultDiameterMeters) / 2;
      const sx = (plant.position.x - bounds.x) * pixelsPerMeter;
      const sy = (plant.position.y - bounds.y) * pixelsPerMeter + radius * pixelsPerMeter + 6;
      canvas.drawRRect(
        Skia.RRectXY(Skia.XYWHRect(sx - textW / 2 - 8, sy, textW + 16, 23), 11.5, 11.5),
        backdrop,
      );
      canvas.drawText(text, sx - textW / 2, sy + 16.5, ink, labelFont);
    }
  });
};

/** Alle Arten nebeneinander, um die Palette und die Formen zu beurteilen. */
const renderSpeciesSheet = async () => {
  const pixelsPerMeter = 90;
  const columns = 4;
  const cell = 2.6;
  const rows = Math.ceil(SPECIES_IDS.length / columns);
  const labelFont = await loadFont(14);

  await writePng(
    "species.png",
    Math.round(columns * cell * pixelsPerMeter),
    Math.round(rows * cell * pixelsPerMeter),
    (canvas) => {
      canvas.save();
      canvas.scale(pixelsPerMeter, pixelsPerMeter);
      const soil = Skia.Paint();
      soil.setColor(Skia.Color("#6b4f3a"));
      canvas.drawRect(Skia.XYWHRect(0, 0, columns * cell, rows * cell), soil);
      const text = Skia.Paint();
      text.setColor(Skia.Color("#fdf6ec"));

      SPECIES_IDS.forEach((id, index) => {
        const species = speciesOf(id);
        const cx = (index % columns) * cell + cell / 2;
        const cy = Math.floor(index / columns) * cell + cell / 2 - 0.15;
        canvas.save();
        canvas.translate(cx, cy);
        canvas.drawPicture(createPlantPicture(species, Math.min(species.defaultDiameterMeters, 2.0), id));
        canvas.restore();
        const scale = 0.22 / labelFont.getSize();
        const width =
          labelFont.getGlyphWidths(labelFont.getGlyphIDs(species.name)).reduce((a, b) => a + b, 0) * scale;
        canvas.save();
        canvas.translate(cx - width / 2, cy + cell / 2 - 0.1);
        canvas.scale(scale, scale);
        canvas.drawText(species.name, 0, 0, text, labelFont);
        canvas.restore();
      });
      canvas.restore();
    },
  );
};

await renderPlan(40, false);
await renderPlan(110);
await renderSpeciesSheet();
