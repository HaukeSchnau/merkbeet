# Android-Build

Merkbeet läuft für die Eltern im Browser. Die APK ist die Zugabe für alle, die
lieber eine installierte App wollen.

## Warum in der Cloud

Das Android-NDK gibt es nur für `linux-x86_64`. srv-2 ist aarch64, und React
Native 0.86 braucht das NDK für die Codegen der neuen Architektur — ein lokaler
Build fiele damit auf Emulation zurück. Deshalb läuft der Build über EAS auf
Expos x86_64-Maschinen.

```bash
pnpm dlx eas-cli@latest build --platform android --profile apk
```

Das Profil `apk` in `eas.json` erzeugt bewusst eine APK und kein AAB: die Datei
soll direkt installiert werden, nicht in den Play Store.

## Signatur

Der Schlüssel liegt bei EAS und wurde beim ersten Build dort erzeugt. Spätere
Versionen tragen denselben Schlüssel und lassen sich über eine installierte
Version ziehen. Ein Schlüsselwechsel würde bei allen eine Neuinstallation
erzwingen — also nicht wechseln.

```bash
pnpm dlx eas-cli@latest credentials   # Schlüssel ansehen oder sichern
```

## Berechtigungen

Die App fragt nur `INTERNET` und den Zugriff auf Fotos. Das Image-Picker-Plugin
würde in seinen Standardwerten außerdem `CAMERA` und `RECORD_AUDIO` ins Manifest
schreiben; beides ist in `app.config.ts` über `cameraPermission: false` und
`microphonePermission: false` abgeschaltet, weil Merkbeet nur die Galerie öffnet.

`SYSTEM_ALERT_WINDOW` und `VIBRATE` kommen aus React Native selbst und sind mit
den Bordmitteln von Expo nicht wegzukonfigurieren.

## Skias native Bibliotheken

`pnpm-workspace.yaml` erlaubt Skias postinstall (`allowBuilds: true`). Es kopiert
die vorgebauten `.so`-Dateien aus `react-native-skia-android` nach
`node_modules/@shopify/react-native-skia/libs/android/` und ist für den
Android-Build zwingend. Es braucht kein Netz, läuft also auch im Nix-Sandbox.

## Wohin die App zeigt

Native hat keine eigene Herkunft, deshalb steht die Serveradresse fest in
`src/sync/endpoint.ts`: `https://merkbeet.schnau.dev`. Überschreibbar beim Bauen
mit `EXPO_PUBLIC_MERKBEET_SERVER`.

## Bildrate

Wie der Plan gezeichnet wird, entscheidet über die Flüssigkeit -- siehe
[performance.md](performance.md).

## Größe

Die APK enthält alle vier ABIs und ist entsprechend groß. Das ist Absicht: so
installiert sie auf jedem Gerät, ohne dass man vorher die Architektur wissen
muss. Wer sie kleiner braucht, kann in `eas.json` auf ABI-getrennte Builds
umstellen.
