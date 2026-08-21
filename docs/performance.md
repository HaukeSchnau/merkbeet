# Bildrate

Die erste Fassung ruckelte schon beim Zoomen und Schieben. Gemessen mit
`pnpm run bench`, das die echte Szene über CanvasKit rastert:

| | vorher | nachher |
| --- | --- | --- |
| Übersicht (34 px/m) | 142 ms/Frame | **20 ms** |
| Detail (110 px/m) | 430 ms/Frame | **122 ms** |
| Skia-Knoten pro Frame | über 50 | 3 |
| Zeichenaufrufe | rund 6000 | rund 200 |
| Weichzeichner | rund 50 | 0 |

Die Zahlen sind CPU-Rasterung in Node, nicht die eines Handy-GPUs. Für
Verhältnisse und für die Anzahl der Aufrufe taugen sie trotzdem.

## Was teuer war

**Jede Kleinigkeit ein eigener Aufruf.** 2600 Grashalme, 1700 Erdkörner, 260
Mulchstücke, pro Pflanze 46 Blätter -- alles einzeln gezeichnet. Skia setzt pro
Aufruf Farbe, Clip und Zustand neu auf; die Geometrie war nicht das Problem,
die Buchhaltung war es. Gleichfarbige Formen kommen jetzt über
`addPath(form, matrix)` in **einen** Pfad. Allein das machte den Untergrund
fünfmal schneller.

**Weichzeichner.** Pro Pflanze ein weichgezeichneter Schatten, dazu Rasenflecken
und Wandschatten. Ein Maskenfilter wird bei jeder Zoomstufe neu berechnet.
Ersetzt durch gestapelte Ellipsen und Bänder mit wenig Deckkraft -- optisch
kaum zu unterscheiden.

**Clip-Pfade.** Solange ein Clip aktiv ist, prüft Skia jeden Aufruf gegen eine
Maske und kann nichts mehr über einen billigen Rechteckvergleich verwerfen. Der
L-förmige Beet-Clip über riesige Schattenrechtecke war allein 17 ms wert. Statt
zu clippen wird jetzt nur innerhalb des Umrisses gestreut (`scatterInside`) --
mit einem Sicherheitsabstand, damit große Formen nicht über die Kante ragen.

**Fünfzig Skia-Knoten pro Frame.** Jede Pflanze und jedes Etikett war ein
eigener Knoten mit eigenem Derived Value. Bei jeder Bewegung wurden alle neu
aufgezeichnet, obwohl sich an den Pflanzen nichts ändert. Jetzt liegen alle
ruhenden Pflanzen in **einem** Bild, das nur neu entsteht, wenn sich die
Pflanzen ändern oder eine angehoben wird; die angehobene ist der einzige
bewegte Knoten.

**Textur in der Übersicht.** Dort ist der ganze Garten im Bild -- die Textur
kostet am meisten und ist am wenigsten zu sehen. Sie wird erst ab einer
Zoomstufe gezeichnet (`DETAIL_ON` in `GardenCanvas.tsx`), zusammen mit den
Etiketten, die sich in der Übersicht ohnehin überlagern würden.

## Was nicht das Problem war

`Group opacity` erzeugt in React Native Skia **keine** Zwischenebene -- die
Deckkraft wird in die Farbe multipliziert (`sksg/Recorder/Player.js`). Ich hatte
das zuerst verdächtigt; nachgesehen ist besser als vermutet.

## Beim Weiterentwickeln

Vor dem Optimieren `pnpm run bench` laufen lassen und danach noch einmal. Der
Benchmark misst Untergrund, Textur und Pflanzen getrennt und prüft mit einem
Ausschnitt auf leerem Rasen, ob das Wegwerfen außerhalb des Bildes noch greift.
