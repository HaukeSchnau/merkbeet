import { Canvas, Circle, Group } from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "./theme";

/**
 * Misst, ob und wie schnell Skia auf diesem Gerät zeichnet.
 *
 * Der Verdacht bei der iOS-Meldung war, dass Safari CanvasKit keinen
 * WebGL-Kontext gibt und Skia auf der CPU rechnet -- dann blockiert jeder Frame
 * den Hauptthread und die App wirkt tot, ohne es zu sein. Diese Probe zeichnet
 * absichtlich viel und zählt, wie viele Frames in zwei Sekunden durchkommen.
 */
export type SkiaProbeResult = { fps: number; frames: number; fehler: string | null };

const KREISE = 300;

export const SkiaProbe = ({ onResult }: { onResult: (result: SkiaProbeResult) => void }) => {
  const [tick, setTick] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const gemeldet = useRef(false);

  useEffect(() => {
    let frames = 0;
    let laufend = true;
    const start = performance.now();

    const schritt = () => {
      if (!laufend) return;
      frames++;
      // Zustand ändern, damit Skia wirklich neu zeichnen muss.
      setTick((n) => n + 1);
      const verstrichen = performance.now() - start;
      if (verstrichen >= 2000) {
        laufend = false;
        if (!gemeldet.current) {
          gemeldet.current = true;
          onResult({ fps: Math.round((frames / verstrichen) * 1000), frames, fehler });
        }
        return;
      }
      requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);

    return () => {
      laufend = false;
    };
  }, [onResult, fehler]);

  // Bewusst ohne Error Boundary in der App: hier gefangen, damit ein Absturz
  // von Skia als Befund erscheint statt den Bildschirm mitzunehmen.
  let inhalt: React.ReactNode = null;
  try {
    inhalt = (
      <Canvas style={styles.canvas}>
        <Group>
          {Array.from({ length: KREISE }, (_, i) => (
            <Circle
              key={i}
              cx={((i * 37) % 300) + (tick % 3)}
              cy={((i * 53) % 120) + 4}
              r={6 + (i % 5)}
              color={i % 2 ? "#4b8054" : "#c2643f"}
              opacity={0.6}
            />
          ))}
        </Group>
      </Canvas>
    );
  } catch (problem) {
    if (!fehler) setFehler(String(problem).slice(0, 120));
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Skia zeichnet {KREISE} Kreise …</Text>
      {inhalt}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, marginTop: spacing.md },
  label: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  canvas: { width: "100%", height: 130, backgroundColor: colors.surfaceMuted },
});
