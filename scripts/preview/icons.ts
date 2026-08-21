/**
 * Rendert die App-Icons aus dem Zeichencode der App.
 *
 *   bun run icons
 *
 * Läuft über CanvasKit in Node, genau wie der Plan-Vorschau-Renderer -- kein
 * Gerät, kein Bildprogramm, und das Ergebnis ist aus dem Repo reproduzierbar.
 */
import type { SkCanvas } from "@shopify/react-native-skia";

import { drawIcon, type IconVariant } from "../../src/view/iconArt";
import { Skia } from "./skia-node";

const ASSETS = new URL("../../assets/", import.meta.url);

const render = async (name: string, size: number, variant: IconVariant, opaque: boolean) => {
  const surface = Skia.Surface.Make(size, size);
  if (!surface) throw new Error("Surface konnte nicht erzeugt werden");
  const canvas: SkCanvas = surface.getCanvas();
  // Vordergrund und Silhouette brauchen Transparenz, damit Android sie über
  // seinen eigenen Hintergrund legen kann.
  canvas.clear(Skia.Color(opaque ? "#6b4f3a" : "#00000000"));

  canvas.save();
  canvas.scale(size, size);
  drawIcon(canvas, variant);
  canvas.restore();

  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes();
  if (!bytes) throw new Error("PNG konnte nicht kodiert werden");
  await Bun.write(new URL(name, ASSETS), bytes);
  console.log(`${name.padEnd(30)} ${size}x${size}`);
};

await render("icon.png", 1024, "full", true);
await render("splash-icon.png", 1024, "foreground", false);
await render("android-icon-foreground.png", 1024, "foreground", false);
await render("android-icon-background.png", 1024, "background", true);
await render("android-icon-monochrome.png", 1024, "monochrome", false);
await render("favicon.png", 96, "full", true);
