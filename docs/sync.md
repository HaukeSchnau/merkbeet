# Sync

Drei Geräte — die Handys beider Eltern und ihr PC — sehen und bearbeiten
denselben Garten. Der Dienst liegt in `server/`, der Client in `src/sync/`.

## Was synchronisiert wird

Nicht „der Garten", sondern die **Abweichung vom Plan im Code**. Ein Eintrag pro
geänderter Pflanze, ein Zeitstempel pro Feld:

```ts
{ id: "rose-w1",
  fields: { notes: { value: "blüht zum zweiten Mal", at: 1787251851059 } } }
```

Das hat zwei Vorteile: Korrekturen an `plan.ts` bleiben auf allen Geräten
wirksam, und über die Leitung geht nur, was Menschen wirklich geändert haben.

## Zusammenführen

Pro **Feld** gewinnt der jüngere Zeitstempel — nicht pro Pflanze. Pflanzenweit
wäre weniger Code, würde aber genau den Alltagsfall verlieren: einer setzt am
Pflanztag Positionen um, während die andere Notizen schreibt. Eine der beiden
Arbeiten wäre stillschweigend weg.

Drei Eigenschaften, auf denen das ruht (alle in `src/sync/merge.test.ts`
festgenagelt):

1. **Alle Zeitstempel kommen vom Server.** Eine falsch gestellte Handy-Uhr
   würde sonst dauerhaft alle anderen überstimmen. Der Preis: eine offline
   gemachte Änderung, die erst morgen ankommt, gilt als die jüngere. Für einen
   Garten, an dem ein paar Mal im Monat etwas passiert, ist das der richtige
   Tausch.
2. **Gleichstand wird fest aufgelöst.** Bei identischem Zeitstempel gewinnt der
   lexikografisch größere Wert. Inhaltlich willkürlich, aber ohne festen
   Ausgang könnten sich zwei Geräte endlos gegenseitig überschreiben.
3. **Ein Feld wird nur angefasst, wenn der Wert sich unterscheidet.** Sonst
   würde ein erneutes Senden nach einem Netzfehler fremde, neuere Änderungen
   verdrängen.

## Offline

Der Normalfall, nicht der Sonderfall. Die App arbeitet immer auf dem lokalen
Stand; eigene Änderungen liegen in einer Warteschlange und gehen beim nächsten
Netz raus. Der Zähler im Kopf der App zeigt, wie viele noch warten.

Eine Ausnahme: **Fotos brauchen eine Verbindung.** Eine lokale Dateiadresse ist
auf den anderen Geräten wertlos, also muss das Bild zum Server. Die Adresse des
Fotos ist dabei selbst der Schlüssel (16 Byte Zufall im Dateinamen) — nötig,
weil `<img>` im Browser keine eigenen Kopfzeilen mitschicken kann.

## Zugang

Ein gemeinsamer Code für die Familie, kein Konto pro Person: es gibt genau einen
Garten, und niemand soll sich ein Passwort merken. Der Code wird auf dem Gerät
gespeichert, die Abfrage kommt also nur beim ersten Mal. Der Vergleich ist
zeitkonstant, und Fehlversuche werden pro Absender gedrosselt.

## Endpunkte

| Route | Zweck |
| --- | --- |
| `GET /healthz` | Für die Überwachung, ohne Code |
| `GET /api/garden?revision=N` | Stand holen; bei gleicher Revision Antwort ohne Daten |
| `POST /api/garden` | Änderungen schicken, bekommt den zusammengeführten Stand zurück |
| `POST /api/photos` | Foto hochladen, gibt den Pfad zurück |
| `GET /api/photos/<id>` | Foto abrufen |
| alles andere | der exportierte Web-Client |

Ein Dienst liefert API **und** Web-Client aus. Damit entfällt CORS, und die App
kann relative Pfade nutzen.

## Lokal ausprobieren

```bash
bun run build:web
MERKBEET_PASSCODE=test MERKBEET_STATE_DIR=.state bun run server
# http://localhost:8787
```

Native zeigt auf `https://merkbeet.schnau.dev`, überschreibbar mit
`EXPO_PUBLIC_MERKBEET_SERVER`.
