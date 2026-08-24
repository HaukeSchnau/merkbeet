import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Stolperdraht gegen Browser-Annahmen im gemeinsamen Code.
 *
 * `window.location.search` hat einen ausgelieferten iOS-Build beim Start
 * abgeschossen: React Native definiert `window` durchaus, aber `location`
 * nicht -- `typeof window === "undefined"` ist deshalb keine taugliche Prüfung
 * auf "läuft im Browser". Die Quellen werden hier abgesucht, weil sich das mit
 * einem Test der Logik nicht fangen lässt: der Absturz passiert erst auf dem
 * Gerät.
 */

const dateien = (verzeichnis: string): string[] =>
  readdirSync(verzeichnis).flatMap((eintrag) => {
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) return dateien(pfad);
    return /\.tsx?$/.test(pfad) && !pfad.endsWith(".test.ts") ? [pfad] : [];
  });

/** Kommentare weg, sonst schlägt die eigene Erklärung dieses Tests an. */
const ohneKommentare = (quelle: string): string =>
  quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const quellen = ["App.tsx", ...dateien("src")].map((pfad) => ({
  pfad,
  inhalt: ohneKommentare(readFileSync(pfad, "utf8")),
}));

/** Dateien, die nur im Browser geladen werden, dürfen Browser-Dinge benutzen. */
const nurWeb = (pfad: string) => pfad.endsWith(".web.ts") || pfad.endsWith(".web.tsx");

describe("Plattform-Annahmen", () => {
  it("greift nirgends über window auf Browser-Dinge zu", () => {
    const treffer = quellen
      .filter(({ pfad }) => !nurWeb(pfad))
      .filter(({ inhalt }) => /\bwindow\.(location|matchMedia|innerWidth|innerHeight|devicePixelRatio)/.test(inhalt))
      .map(({ pfad }) => pfad);
    expect(treffer).toEqual([]);
  });

  it("prüft die Plattform über Platform.OS, nicht über typeof window", () => {
    const treffer = quellen
      .filter(({ pfad }) => !nurWeb(pfad))
      .filter(({ inhalt }) => /typeof window === ["']undefined["']/.test(inhalt))
      .map(({ pfad }) => pfad);
    expect(treffer).toEqual([]);
  });

  it("fasst document nur an, wo vorher auf Web geprüft wurde", () => {
    const treffer = quellen
      .filter(({ pfad }) => !nurWeb(pfad))
      .filter(({ inhalt }) => /\bdocument\./.test(inhalt))
      .filter(({ inhalt }) => !inhalt.includes('Platform.OS !== "web"'))
      .map(({ pfad }) => pfad);
    expect(treffer).toEqual([]);
  });
});
