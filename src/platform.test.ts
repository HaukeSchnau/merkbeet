import { describe, expect, it } from "vite-plus/test";
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

/** Die Dateien außer den reinen Web-Dateien, deren Quelltext `passt`. */
const treffer = (passt: (inhalt: string) => boolean) =>
  quellen.flatMap(({ pfad, inhalt }) => (!nurWeb(pfad) && passt(inhalt) ? [pfad] : []));

describe("Plattform-Annahmen", () => {
  it("greift nirgends über window auf Browser-Dinge zu", () => {
    expect(
      treffer((inhalt) =>
        /\bwindow\.(location|matchMedia|innerWidth|innerHeight|devicePixelRatio)/.test(inhalt),
      ),
    ).toEqual([]);
  });

  it("prüft die Plattform über Platform.OS, nicht über typeof window", () => {
    expect(treffer((inhalt) => /typeof window === ["']undefined["']/.test(inhalt))).toEqual([]);
  });

  it("fasst document nur an, wo vorher auf Web geprüft wurde", () => {
    expect(
      treffer((inhalt) => /\bdocument\./.test(inhalt) && !inhalt.includes('Platform.OS !== "web"')),
    ).toEqual([]);
  });
});
