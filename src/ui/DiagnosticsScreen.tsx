import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { SERVER_BASE } from "../sync/endpoint";
import { SkiaProbe, type SkiaProbeResult } from "./SkiaProbe";
import { colors, radii, spacing } from "./theme";

/**
 * Diagnose für Geräte, an die ich nicht herankomme.
 *
 * Erreichbar über `?diag=1`. Bewusst ohne Skia und ohne Expo UI -- wenn dieser
 * Bildschirm reagiert, die App aber nicht, liegt es an einer dieser beiden
 * Schichten und nicht an JavaScript oder am Netz.
 *
 * Der Bericht geht an den Server, damit ich ihn selbst lesen kann, statt ihn
 * abtippen zu lassen.
 */

type Befund = { name: string; wert: string };

const webglBefunde = (): Befund[] => {
  if (typeof document === "undefined") return [{ name: "WebGL", wert: "nicht im Browser" }];
  const befunde: Befund[] = [];

  const versuch = (art: "webgl" | "webgl2", offscreen: boolean): string => {
    try {
      const OC = (globalThis as { OffscreenCanvas?: new (w: number, h: number) => unknown })
        .OffscreenCanvas;
      if (offscreen && !OC) return "OffscreenCanvas fehlt";
      const leinwand = offscreen
        ? (new OC!(64, 64) as { getContext: (t: string) => unknown })
        : document.createElement("canvas");
      const ctx = leinwand.getContext(art);
      if (!ctx) return "kein Kontext";
      const info = ctx as { getParameter?: (p: number) => unknown; VERSION?: number };
      const version = info.getParameter && info.VERSION ? String(info.getParameter(info.VERSION)) : "ok";
      return version.slice(0, 60);
    } catch (fehler) {
      return `Fehler: ${String(fehler).slice(0, 60)}`;
    }
  };

  befunde.push({ name: "WebGL (canvas)", wert: versuch("webgl", false) });
  befunde.push({ name: "WebGL2 (canvas)", wert: versuch("webgl2", false) });
  befunde.push({ name: "WebGL (offscreen)", wert: versuch("webgl", true) });
  befunde.push({
    name: "OffscreenCanvas",
    wert: String(typeof (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas),
  });
  befunde.push({
    name: "CanvasKit geladen",
    wert: String(typeof (globalThis as { CanvasKit?: unknown }).CanvasKit),
  });
  return befunde;
};

const umgebung = (): Befund[] => {
  const nav = typeof navigator === "undefined" ? null : navigator;
  const win = typeof window === "undefined" ? null : window;
  return [
    { name: "Plattform", wert: Platform.OS },
    { name: "User-Agent", wert: nav?.userAgent?.slice(0, 160) ?? "unbekannt" },
    { name: "Bildschirm", wert: win ? `${win.innerWidth}x${win.innerHeight} @${win.devicePixelRatio}` : "?" },
    {
      name: "Vom Startbildschirm",
      wert: String(
        (nav as { standalone?: boolean } | null)?.standalone ??
          win?.matchMedia?.("(display-mode: standalone)").matches ??
          "?",
      ),
    },
    { name: "Kerne", wert: String((nav as { hardwareConcurrency?: number } | null)?.hardwareConcurrency ?? "?") },
    { name: "AbortSignal.timeout", wert: String(typeof AbortSignal?.timeout) },
  ];
};

/** Wie lange braucht ein einfacher Füllvorgang? Grobes Maß für die Grafikleistung. */
const zeichenprobe = (): Befund[] => {
  if (typeof document === "undefined") return [];
  try {
    const leinwand = document.createElement("canvas");
    leinwand.width = 780;
    leinwand.height = 1400;
    const ctx = leinwand.getContext("2d");
    if (!ctx) return [{ name: "2D-Kontext", wert: "fehlt" }];
    const start = performance.now();
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = i % 2 ? "rgba(80,120,60,0.5)" : "rgba(120,80,60,0.5)";
      ctx.beginPath();
      ctx.ellipse(i * 2, i * 3, 40, 30, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return [{ name: "400 Ellipsen (2D)", wert: `${(performance.now() - start).toFixed(1)} ms` }];
  } catch (fehler) {
    return [{ name: "2D-Probe", wert: `Fehler: ${String(fehler).slice(0, 60)}` }];
  }
};

export const DiagnosticsScreen = () => {
  const [befunde, setBefunde] = useState<Befund[]>([]);
  const [gesendet, setGesendet] = useState<string | null>(null);
  const [tippZaehler, setTippZaehler] = useState(0);
  const [skiaLaeuft, setSkiaLaeuft] = useState(false);
  const [skia, setSkia] = useState<SkiaProbeResult | null>(null);
  /**
   * Rohe Ereigniszähler direkt am Dokument. Wenn hier nichts hochgeht, kommen
   * Berührungen gar nicht bis zur App -- dann liegt es an der Seite selbst
   * (Viewport, touch-action) und nicht an React oder Skia.
   */
  const [roh, setRoh] = useState({ touchstart: 0, pointerdown: 0, click: 0 });

  useEffect(() => {
    setBefunde([...umgebung(), ...webglBefunde(), ...zeichenprobe()]);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const zaehle = (art: keyof typeof roh) => () =>
      setRoh((vorher) => ({ ...vorher, [art]: vorher[art] + 1 }));
    const listener: Array<[string, () => void]> = [
      ["touchstart", zaehle("touchstart")],
      ["pointerdown", zaehle("pointerdown")],
      ["click", zaehle("click")],
    ];
    for (const [art, fn] of listener) document.addEventListener(art, fn, { passive: true });
    return () => {
      for (const [art, fn] of listener) document.removeEventListener(art, fn);
    };
    // roh wird nur im Updater gelesen, deshalb bewusst nicht in den Abhängigkeiten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const senden = async () => {
    try {
      const antwort = await fetch(`${SERVER_BASE}/api/diag`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ befunde, tippZaehler, skia, roh }),
      });
      setGesendet(antwort.ok ? "Bericht ist angekommen." : `Server antwortete ${antwort.status}.`);
    } catch (fehler) {
      setGesendet(`Konnte nicht senden: ${String(fehler).slice(0, 80)}`);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Merkbeet — Diagnose</Text>
      <Text style={styles.hint}>
        Dieser Bildschirm benutzt weder Skia noch native Bedienelemente. Wenn hier alles reagiert,
        die App aber nicht, liegt es an einer dieser beiden Schichten.
      </Text>

      {befunde.map((befund) => (
        <View key={befund.name} style={styles.row}>
          <Text style={styles.label}>{befund.name}</Text>
          <Text style={styles.value}>{befund.wert}</Text>
        </View>
      ))}

      <View style={styles.row}>
        <Text style={styles.label}>Rohe Berührungen am Dokument</Text>
        <Text style={styles.value}>
          touchstart {roh.touchstart} · pointerdown {roh.pointerdown} · click {roh.click}
        </Text>
      </View>

      {skia ? (
        <View style={styles.row}>
          <Text style={styles.label}>Skia</Text>
          <Text style={styles.value}>
            {skia.fehler ?? `${skia.fps} Bilder pro Sekunde (${skia.frames} in 2 s)`}
          </Text>
        </View>
      ) : null}

      {skiaLaeuft && !skia ? (
        <SkiaProbe
          onResult={(ergebnis) => {
            setSkia(ergebnis);
            setSkiaLaeuft(false);
          }}
        />
      ) : (
        <Pressable style={styles.button} onPress={() => setSkiaLaeuft(true)}>
          <Text style={styles.buttonText}>Skia messen (2 Sekunden)</Text>
        </Pressable>
      )}

      <Pressable style={styles.button} onPress={() => setTippZaehler((n) => n + 1)}>
        <Text style={styles.buttonText}>Reagiert dieser Knopf? ({tippZaehler})</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={() => void senden()}>
        <Text style={styles.buttonText}>Bericht an Hauke senden</Text>
      </Pressable>

      {gesendet ? <Text style={styles.hint}>{gesendet}</Text> : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  hint: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  row: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  label: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  value: { fontSize: 14, color: colors.text },
  button: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
  },
  buttonText: { fontSize: 16, fontWeight: "700", color: colors.surface },
});
