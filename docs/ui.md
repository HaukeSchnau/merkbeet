# Bedienoberfläche

Die Oberfläche benutzt `@expo/ui` — dieselben Komponenten werden auf Android zu
Jetpack Compose, auf iOS zu SwiftUI und im Browser zu einem Nachbau in React
Native Web. Damit fühlt sich die App auf dem Gerät nach System an, ohne dass die
Web-Variante wegfällt, die meine Eltern tatsächlich benutzen.

Nur die Wurzel eines solchen Teilbaums braucht einen `Host`. Über
`seedColor={colors.accent}` leitet Android daraus eine vollständige
Material-3-Palette ab, sodass Schalter und Knöpfe Merkbeets Terrakotta tragen
statt Expo-Blau.

| Fläche | Komponenten |
| --- | --- |
| Kopfzeile | `Switch` für Etiketten, `Button` für den Bearbeiten-Modus |
| Zugangscode | `TextInput` (mit Systemtastatur), `Button` |
| Pflanzenkarte | `BottomSheet` mit `FieldGroup`-Abschnitten, `TextInput`, `Slider` |
| Artenauswahl | `BottomSheet` mit `List` und `ListItem` |

Der Plan selbst bleibt Skia — dort geht es um freies Zeichnen, nicht um
Bedienelemente.

## Was dabei zu beachten war

**`Column` richtet linksbündig aus.** Kinder schrumpfen dann auf ihre
Inhaltsbreite. Für eine Feldgruppe, die das Sheet füllen soll, entweder ohne
Column arbeiten oder `style={{ width: "100%" }}` setzen.

**Der `Host` eines Bottom Sheets braucht Fläche.** Mit Breite 0 erbt der
Sheet-Inhalt die Einschränkung und wird zusammengequetscht. Er spannt deshalb
die ganze Fläche auf, mit `pointerEvents="box-none"`, damit Gesten zum Plan
durchkommen, solange kein Sheet offen ist.

**`matchContents` bemisst den Host am Inhalt.** Bei langem Fließtext läuft er
über den Rand hinaus. Fließtext bleibt deshalb im React-Native-Layout, wo er
schrumpfen kann; nur die Bedienelemente stehen im Host.

## Der Sync-Zustand

Früher stand dauerhaft "Aktuell" in der Kopfzeile. Das ist die Information, die
niemanden interessiert -- dass es funktioniert, ist der Normalfall.
`SyncNotice` zeigt jetzt nur etwas, wenn Änderungen warten, die Verbindung fehlt
oder der Code gebraucht wird, und bietet dann "Erneut" an.

## Eigener Swift- oder Kotlin-Code

Bisher nicht nötig: Expo UI deckt alle Flächen dieser App ab, und der Plan wird
ohnehin nativ über Skia gezeichnet. Ein eigenes Modul würde den Build
verkomplizieren und bräuchte für die Web-Variante zusätzlich eine Attrappe --
ohne dass etwas dazukäme. Falls doch etwas fehlt (Teilen-Dialog, Widget,
Haptik), ist der Weg über die Expo Modules API offen.
