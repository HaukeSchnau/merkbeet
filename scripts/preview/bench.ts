/**
 * Misst, was ein Frame kostet.
 *
 *   bun run bench
 *
 * Rastert die echte Szene über CanvasKit in Node. Die absoluten Zahlen sind
 * nicht die eines Handy-GPUs, aber die Verhältnisse zeigen, wo die Zeit
 * hingeht -- und die Anzahl der Zeichenbefehle ist direkt vergleichbar.
 */
import type { SkCanvas } from "@shopify/react-native-skia";

import { GARDEN_PLAN } from "../../src/garden/plan";
import { speciesOf } from "../../src/garden/species";
import {
  createGroundAnnotationsPicture,
  createGroundFlatPicture,
  createGroundTexturePicture,
} from "../../src/view/ground";
import { createPlantPicture } from "../../src/view/plantArt";
import { Skia } from "./skia-node";

const WIDTH = 780;
const HEIGHT = 1436;
const FRAMES = 40;

const time = (label: string, run: () => void) => {
  const started = Bun.nanoseconds();
  run();
  const ms = (Bun.nanoseconds() - started) / 1e6;
  console.log(`${label.padEnd(34)} ${ms.toFixed(1).padStart(8)} ms`);
  return ms;
};

const groundFlat = createGroundFlatPicture();
const groundTexture = createGroundTexturePicture();

const plantPictures = GARDEN_PLAN.plants.map((plant) => {
  const species = speciesOf(plant.speciesId);
  return {
    plant,
    picture: createPlantPicture(species, plant.diameterMeters ?? species.defaultDiameterMeters, plant.id),
  };
});

const bounds = GARDEN_PLAN.bounds;
const cull = Skia.XYWHRect(bounds.x, bounds.y, bounds.width, bounds.height);

// So wie der Canvas es tut: alle ruhenden Pflanzen in einem Bild.
const restingPlants = (() => {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(cull);
  for (const { plant, picture } of plantPictures) {
    canvas.save();
    canvas.translate(plant.position.x, plant.position.y);
    canvas.drawPicture(picture);
    canvas.restore();
  }
  return recorder.finishRecordingAsPicture();
})();

const surface = Skia.Surface.Make(WIDTH, HEIGHT);
if (!surface) throw new Error("Surface konnte nicht erzeugt werden");
const canvas: SkCanvas = surface.getCanvas();

const drawFrame = (scale: number, offset: number, texture: boolean, worldX = 0, worldY = 0) => {
  canvas.clear(Skia.Color("#8fb26e"));
  canvas.save();
  canvas.translate(-offset - worldX * scale, -offset / 2 - worldY * scale);
  canvas.scale(scale, scale);
  canvas.drawPicture(texture ? groundTexture : groundFlat);
  canvas.drawPicture(restingPlants);
  canvas.restore();
  surface.flush();
};

const measure = (label: string, scale: number, texture: boolean, worldX = 0, worldY = 0) => {
  drawFrame(scale, 0, texture, worldX, worldY);
  const started = Bun.nanoseconds();
  for (let i = 0; i < FRAMES; i++) drawFrame(scale, i * 0.5, texture, worldX, worldY);
  const ms = (Bun.nanoseconds() - started) / 1e6 / FRAMES;
  console.log(`  ${label.padEnd(30)} ${ms.toFixed(1).padStart(7)} ms/Frame`);
};

console.log("Übersicht (34 px/m) -- ohne Textur, wie die App es zeichnet");
measure("Basis + Pflanzen", 34, false);
measure("(mit Textur, zum Vergleich)", 34, true);
console.log();
console.log("Detail (110 px/m) -- mit Textur");
measure("Basis + Textur + Pflanzen", 110, true);
measure("(ohne Textur, zum Vergleich)", 110, false);
console.log();
console.log("Prüft das Wegwerfen: Ausschnitt auf leerem Rasen weit weg");
measure("Detail auf Rasen (16,-2)", 110, true, 16, -2.5);
console.log();
console.log("Textur über die Zoomstufen (Ausschnitt aufs Beet)");
for (const scale of [44, 52, 65, 80, 100, 140]) {
  measure(`${scale} px/m`, scale, true, 0, 0);
}
