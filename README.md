# Merkbeet

Eine Gartenkarte für ein einzelnes, vermessenes Grundstück. Merkbeet zeigt
Beete und Pflanzen an ihren tatsächlichen Positionen und hält Änderungen über
mehrere Geräte hinweg synchron.

Die App ist bewusst kein allgemeiner Gartenplaner. Sie ist auf einen konkreten
Plan zugeschnitten und dient vor allem als Beispiel dafür, wie sich räumliche
Daten mit React Native Skia darstellen und bearbeiten lassen.

![Der Plan](docs/preview/plan-110px.png)

## Was drin ist

- Maßstabsgetreuer Plan von oben: Haus, Terrasse, L-förmiges Beet, Rasen
- 25 Pflanzen aus der Handskizze, an ihren gemessenen Positionen
- Verschieben, Pinch-Zoom, Panning über die ganze Länge von 19,50 m
- Antippen öffnet die Pflanzenkarte: Name, Foto, Notizen, Pflanzdatum, Größe
- Etiketten lassen sich ausblenden; beim Herauszoomen verschwinden sie von selbst
- Bearbeiten-Modus: erst darin lässt sich etwas verschieben, ändern, hinzufügen
  oder entfernen — im Alltag kann also nichts verrutschen
- Gemeinsamer Stand auf allen Geräten, offline weiterarbeiten inklusive —
  siehe [docs/sync.md](docs/sync.md)
- Native Bedienelemente: Jetpack Compose auf Android, SwiftUI auf iOS, im
  Browser ein Nachbau — siehe [docs/ui.md](docs/ui.md)

## Loslegen

```bash
pnpm install
pnpm run android     # oder: pnpm run ios
```

Skia ist kein Teil von Expo Go, deshalb braucht die App einen Dev-Client oder
einen echten Build. Für Android gibt es eine fertige APK — wie sie gebaut wird,
steht in [docs/android.md](docs/android.md).

Die Web-Variante läuft ebenfalls vollständig — Skia kommt dort als CanvasKit
(WebAssembly) und braucht WebGL, das jeder aktuelle Handy-Browser hat.

## Deployment

Die Web-App läuft unter **<https://merkbeet.schnau.dev>**. Ein gemeinsamer
Zugangscode schützt die synchronisierten Daten.

Lokal:

```bash
pnpm install
pnpm run setup:web    # legt canvaskit.wasm in public/ ab (nicht im Repo)
pnpm run web          # Dev-Server
pnpm run server       # Sync-Dienst, braucht MERKBEET_PASSCODE
```

```bash
pnpm run typecheck   # tsc --noEmit
pnpm run test        # Merge-Konvergenz und Sync-Dienst über HTTP
pnpm run preview     # rendert docs/preview/*.png ohne Gerät oder Emulator
pnpm run icons       # rendert assets/*.png -- das Icon kommt aus dem Code
pnpm run bench       # misst, was ein Frame kostet
```

`pnpm run preview` ruft denselben Zeichencode wie die App auf, nur mit CanvasKit
in Node statt React Native. Das ist der schnellste Weg, an der Grafik zu
arbeiten: einmal laufen lassen, PNG anschauen.

## Aufbau

```
src/garden/     Datenmodell und der Garten selbst (plan.ts, species.ts)
src/state/      Zustand, lokale Persistenz, Sync-Zyklus
src/sync/       Sync-Datenmodell und Zusammenführen (rein, mit Tests)
src/view/       Skia-Rendering, Viewport, Gesten
src/ui/         Bildschirme und Bedienelemente (@expo/ui, siehe docs/ui.md)
server/         Sync-Dienst: Bun, SQLite, liefert den Web-Client mit aus
scripts/        Ableitung der Skizzendaten, Vorschau-Renderer
docs/           Gartenmodell, Sync, Referenzskizze, Vorschaubilder
```

Drei Entscheidungen, die den Rest erklären:

**Koordinaten sind Meter.** Der Viewport rechnet in Pixel pro Meter um. Damit
sind Beetgeometrie und Pflanzenpositionen unabhängig von der Bildschirmgröße,
und Größenangaben in der Pflanzenkarte stimmen mit dem Bild überein.

**Pflanzen werden gezeichnet, nicht geladen.** Jede Art ist eine typisierte
Beschreibung aus Form, Blütenart und Farbpalette (`src/garden/species.ts`);
`src/view/plantArt.ts` macht daraus ein Skia-Picture. Kein Asset-Pipeline, bei
jedem Zoom scharf, und der Stil ist über den ganzen Garten automatisch
einheitlich. Der Zufall pro Pflanze ist aus ihrer id abgeleitet, damit dieselbe
Pflanze immer gleich aussieht.

Sobald es gezeichnete Bilder gibt, wird pro Art nur der `art`-Eintrag von
`{ kind: "procedural", … }` auf `{ kind: "asset", source: require("…png") }`
umgestellt. Renderer und Daten bleiben unverändert.

**Der Plan wird in wenigen Sammelpfaden gezeichnet, nicht Form für Form.** Was
gleich aussieht, landet in einem Pfad und wird mit einem Aufruf gezeichnet; die
Bodentextur kommt erst beim Hineinzoomen dazu. Warum das so ist und was es
gebracht hat, steht in [docs/performance.md](docs/performance.md) -- wer daran
arbeitet, sollte das vorher lesen.

**Das Icon ist gezeichnet, nicht gemalt.** `pnpm run icons` rendert die
Sternmagnolie von oben auf Beeterde — mit demselben Code, der sie im Plan
zeichnet (`src/view/iconArt.ts`). Kein Bildprogramm, und aus dem Repo
reproduzierbar. Für das monochrome Android-Icon steht eine reduzierte
Blütenform daneben, weil eine einfarbige Silhouette der ganzen Pflanze zu
einem Klumpen verschmilzt.

**Synchronisiert wird die Abweichung, nicht der Garten.** Über die Leitung geht
nur, was Menschen geändert haben — je Feld mit einem Zeitstempel vom Server.
Damit bleiben Korrekturen an `plan.ts` überall wirksam, und zwei Leute können am
selben Strauch arbeiten, ohne sich zu überschreiben.

![Die Arten](docs/preview/species.png)

## Gartenmodell

In [docs/garden-model.md](docs/garden-model.md) steht, wie Maße, Schätzwerte und
Pflanzenpositionen im Datenmodell abgebildet sind.
