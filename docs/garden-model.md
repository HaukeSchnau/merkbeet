# Das Gartenmodell

Alle Geometrie liegt in `src/garden/plan.ts`, in echten Metern. Ursprung ist die
Nordwestecke des Beetes, x zeigt nach Osten, y nach Süden. Norden ist im Plan
oben — so wie auf der Skizze.

Quelle ist `docs/reference/garden-sketch.jpg` (handgezeichnet, aufgenommen am
14.05.2026). `docs/reference/garden-sketch-aufgerichtet.jpg` ist dieselbe Skizze
aufgerichtet und ist die Vorlage, aus der die Koordinaten abgelesen wurden.
`scripts/derive-plan.py` rechnet die abgelesenen Pixelpositionen in Meter um und
dokumentiert die Kalibrierung.

## Gemessen (auf der Skizze notiert)

| Maß | Bedeutung |
| --- | --- |
| 19,50 m | Gesamtlänge des Beetes, West nach Ost |
| 7,60 m | Länge des Westarms, Nord nach Süd |
| 2,50 m | Breite des Westarms |
| 2,30 m | Tiefe des Südarms |

Daraus folgt direkt die Terrassentiefe: 7,60 − 2,30 = **5,30 m**.

## Angenommen (aus den Proportionen geschätzt)

Diese Werte stehen so im Plan, sind aber nicht gemessen. Wenn du nachmisst,
sind es die Zeilen, die sich ändern:

- **Terrassenbreite 8,20 m.** Aus dem Seitenverhältnis der Skizze.
- **Hausbreite 17,00 m**, also 19,50 − 2,50. Auf der Skizze endet das Haus rund
  0,4 m vor dem Beetende; hier sind beide Kanten bündig gesetzt.
- **Sichtbare Haustiefe 3,50 m.** Das Haus ist auf der Skizze angeschnitten und
  wird auch im Plan nur angeschnitten gezeigt — es ist reine Orientierung.
- **Die Terrasse liegt bündig an der Westwand des Hauses.**
- **Rasen** ist auf der Skizze nicht eingezeichnet und liegt hier als
  Untergrund um alles herum.

Die Skizze ist waagerecht maßstabsgetreu (rund 46 px/m), senkrecht dagegen
gestaucht. Deshalb werden Pflanzenpositionen nicht linear umgerechnet, sondern
anteilig innerhalb ihres Beetstreifens — so landet jede Pflanze in dem Streifen,
in dem sie gezeichnet war. Details in `scripts/derive-plan.py`.

## Pflanzen

25 Pflanzen, 11 Arten. Die Namen auf der Skizze sind Kürzel; so wurden sie
gelesen:

| Skizze | Art |
| --- | --- |
| Ros | Rose |
| Lav | Lavendel |
| Hort | Hortensie |
| Spier | Spiere (*Spiraea*) |
| Gras | Ziergras |
| Somm.flieder | Sommerflieder (*Buddleja davidii*) |
| Schneeball | Schneeball (*Viburnum*) |
| Sternmagnolie | Sternmagnolie (*Magnolia stellata*) |
| Glanzmispel | Glanzmispel (*Photinia fraseri* 'Red Robin') |
| Lorbeer Port. | Portugiesischer Lorbeer (*Prunus lusitanica*) |
| Kilimand | Kilimandscharo |

**Noch zu klären:** "Kilimandscharo" ist auf der Skizze groß eingezeichnet
(rund 2 m) und als Rispenhortensie *Hydrangea paniculata* modelliert. Die Sorte
sollte bei den Eltern bestätigt werden. Ebenso sind alle Kronendurchmesser aus
der Größe der gezeichneten Kreise geschätzt, nicht gemessen.

## Korrekturen einpflegen

Positionen, Namen, Pflanzdaten und Größen lassen sich direkt in der App im
Bearbeiten-Modus ändern. Gespeichert wird nur die **Abweichung** vom Plan im
Code (siehe `src/state/persistence.ts`). Korrekturen an `plan.ts` wirken also
auch auf Geräten, auf denen schon etwas verschoben wurde, ohne diese Änderungen
zu überschreiben.
