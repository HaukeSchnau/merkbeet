import { Nunito_700Bold } from "@expo-google-fonts/nunito";
import {
  Canvas,
  Circle,
  Group,
  Path,
  Picture,
  RoundedRect,
  Skia,
  Text,
  useFont,
  type SkFont,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useDerivedValue, useSharedValue, type SharedValue } from "react-native-reanimated";

import { GARDEN_PLAN } from "../garden/plan";
import { speciesOf, type Species } from "../garden/species";
import type { Plant, PlantId, Point } from "../garden/types";
import { colors } from "../ui/theme";
import { createGroundPicture } from "./ground";
import { createPlantPicture } from "./plantArt";
import { textWidth } from "./text";
import { clampTranslation, resetViewport, scaleLimits, useViewport, type Screen } from "./viewport";

/** Mindestradius eines Antippziels in Pixeln -- kleine Pflanzen bleiben treffbar. */
const MIN_TOUCH_RADIUS = 24;

/**
 * Ab welcher Zoomstufe (Pixel pro Meter) Etiketten sichtbar werden. In der
 * Uebersicht liegen die Pflanzen so dicht, dass sich die Namen ueberlagern
 * wuerden; dazwischen wird weich eingeblendet.
 */
const LABEL_FADE_FROM = 45;
const LABEL_FADE_TO = 65;

type HitTarget = { id: PlantId; x: number; y: number; r: number };

type DragState = {
  id: SharedValue<PlantId | null>;
  dx: SharedValue<number>;
  dy: SharedValue<number>;
};

const diameterOf = (plant: Plant, species: Species) => plant.diameterMeters ?? species.defaultDiameterMeters;

type PlantNodeProps = {
  plant: Plant;
  species: Species;
  scale: SharedValue<number>;
  drag: DragState;
  selected: boolean;
};

/** Eine Pflanze: einmal aufgezeichnetes Bild, das nur noch verschoben wird. */
const PlantNode = ({ plant, species, scale, drag, selected }: PlantNodeProps) => {
  const diameter = diameterOf(plant, species);
  const picture = useMemo(
    () => createPlantPicture(species, diameter, plant.id),
    [species, diameter, plant.id],
  );

  const transform = useDerivedValue(() => {
    const dragging = drag.id.value === plant.id;
    return [
      { translateX: plant.position.x + (dragging ? drag.dx.value / scale.value : 0) },
      { translateY: plant.position.y + (dragging ? drag.dy.value / scale.value : 0) },
    ];
  });
  // Die Auswahlmarkierung soll auf jeder Zoomstufe gleich dick aussehen.
  const ringWidth = useDerivedValue(() => 2.5 / scale.value);

  return (
    <Group transform={transform}>
      <Picture picture={picture} />
      {selected ? (
        <Circle
          cx={0}
          cy={0}
          r={diameter / 2 + 0.14}
          color={colors.accent}
          style="stroke"
          strokeWidth={ringWidth}
        />
      ) : null}
    </Group>
  );
};

type PlantLabelProps = {
  plant: Plant;
  text: string;
  font: SkFont;
  radiusMeters: number;
  viewport: ReturnType<typeof useViewport>;
  drag: DragState;
};

/**
 * Etiketten liegen ausserhalb der Weltgruppe und werden pro Frame auf
 * Bildschirmkoordinaten umgerechnet. So bleibt die Schrift bei jedem
 * Zoomfaktor gleich gross und lesbar.
 */
const PlantLabel = ({ plant, text, font, radiusMeters, viewport, drag }: PlantLabelProps) => {
  const width = useMemo(() => textWidth(font, text), [font, text]);
  const transform = useDerivedValue(() => {
    const dragging = drag.id.value === plant.id;
    const scale = viewport.scale.value;
    const wx = plant.position.x + (dragging ? drag.dx.value / scale : 0);
    const wy = plant.position.y + (dragging ? drag.dy.value / scale : 0);
    return [
      { translateX: wx * scale + viewport.tx.value },
      { translateY: wy * scale + viewport.ty.value + radiusMeters * scale + 6 },
    ];
  });

  return (
    <Group transform={transform}>
      <RoundedRect
        x={-width / 2 - 8}
        y={0}
        width={width + 16}
        height={23}
        r={11.5}
        color={colors.labelBackground}
      />
      <Text x={-width / 2} y={16.5} text={text} font={font} color={colors.labelText} />
    </Group>
  );
};

/** Kleine Windrose oben rechts -- Norden ist im Plan oben. */
const Compass = ({ screen, font }: { screen: Screen; font: SkFont | null }) => {
  const cx = screen.width - 34;
  const cy = 34;
  const needle = useMemo(
    () =>
      Skia.PathBuilder.Make()
        .addPoly(
          [
            { x: cx, y: cy - 13 },
            { x: cx + 6, y: cy + 8 },
            { x: cx, y: cy + 3 },
            { x: cx - 6, y: cy + 8 },
          ],
          true,
        )
        .detach(),
    [cx, cy],
  );

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={20} color={colors.labelBackground} />
      <Path path={needle} color={colors.accent} />
      {font ? (
        <Text x={cx - textWidth(font, "N") / 2} y={cy + 18} text="N" font={font} color={colors.labelText} />
      ) : null}
    </Group>
  );
};

export type GardenCanvasProps = {
  plants: Plant[];
  showLabels: boolean;
  editMode: boolean;
  /** Der naechste Tipp setzt eine neue Pflanze statt eine auszuwaehlen. */
  placing: boolean;
  selectedId: PlantId | null;
  onSelect: (id: PlantId | null) => void;
  onMove: (id: PlantId, position: Point) => void;
  onPlace: (position: Point) => void;
};

export const GardenCanvas = ({
  plants,
  showLabels,
  editMode,
  placing,
  selectedId,
  onSelect,
  onMove,
  onPlace,
}: GardenCanvasProps) => {
  const [screen, setScreen] = useState<Screen | null>(null);
  const viewport = useViewport();
  const dragId = useSharedValue<PlantId | null>(null);
  const dragDx = useSharedValue(0);
  const dragDy = useSharedValue(0);
  const drag: DragState = useMemo(
    () => ({ id: dragId, dx: dragDx, dy: dragDy }),
    [dragId, dragDx, dragDy],
  );
  const hitTargets = useSharedValue<HitTarget[]>([]);
  const editing = useSharedValue(editMode);
  const placingNow = useSharedValue(placing);
  /**
   * Startwerte der laufenden Geste. Sie muessen Shared Values sein: Reanimated
   * gibt jedem Worklet eine eigene Kopie der eingefangenen Variablen, sodass
   * `onStart` und `onUpdate` sich ueber ein normales Objekt nichts mitteilen
   * koennten.
   */
  const gestureStart = {
    tx: useSharedValue(0),
    ty: useSharedValue(0),
    scale: useSharedValue(1),
  };
  const fitted = useRef(false);

  const font = useFont(Nunito_700Bold, 14);
  const ground = useMemo(() => createGroundPicture(font), [font]);

  // Von Nord nach Sued zeichnen, damit vordere Pflanzen die hinteren ueberdecken.
  const ordered = useMemo(() => [...plants].sort((a, b) => a.position.y - b.position.y), [plants]);

  useEffect(() => {
    editing.value = editMode;
  }, [editMode, editing]);

  useEffect(() => {
    placingNow.value = placing;
  }, [placing, placingNow]);

  useEffect(() => {
    hitTargets.value = plants.map((plant) => ({
      id: plant.id,
      x: plant.position.x,
      y: plant.position.y,
      r: diameterOf(plant, speciesOf(plant.speciesId)) / 2,
    }));
  }, [plants, hitTargets]);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (width === 0 || height === 0) return;
      setScreen((previous) => {
        if (previous && previous.width === width && previous.height === height) return previous;
        return { width, height };
      });
      if (!fitted.current) {
        resetViewport(viewport, GARDEN_PLAN.bounds, { width, height });
        fitted.current = true;
      }
    },
    [viewport],
  );

  const commitMove = useCallback(
    (id: PlantId, x: number, y: number) => {
      onMove(id, { x, y });
    },
    [onMove],
  );

  const gesture = useMemo(() => {
    if (!screen) return Gesture.Tap();
    const { bounds } = GARDEN_PLAN;
    const limits = scaleLimits(bounds, screen);

    const findPlant = (sx: number, sy: number): HitTarget | null => {
      "worklet";
      let best: HitTarget | null = null;
      let bestDistance = Infinity;
      for (const target of hitTargets.value) {
        const px = target.x * viewport.scale.value + viewport.tx.value;
        const py = target.y * viewport.scale.value + viewport.ty.value;
        const radius = Math.max(target.r * viewport.scale.value, MIN_TOUCH_RADIUS);
        const distance = Math.sqrt((sx - px) ** 2 + (sy - py) ** 2);
        if (distance <= radius && distance < bestDistance) {
          best = target;
          bestDistance = distance;
        }
      }
      return best;
    };

    const clamp = () => {
      "worklet";
      viewport.tx.value = clampTranslation(viewport.tx.value, viewport.scale.value, bounds.x, bounds.width, screen.width);
      viewport.ty.value = clampTranslation(viewport.ty.value, viewport.scale.value, bounds.y, bounds.height, screen.height);
    };

    const pan = Gesture.Pan()
      .maxPointers(1)
      .onStart((event) => {
        "worklet";
        const hit = editing.value ? findPlant(event.x, event.y) : null;
        if (hit) {
          drag.id.value = hit.id;
          drag.dx.value = 0;
          drag.dy.value = 0;
        } else {
          drag.id.value = null;
          gestureStart.tx.value = viewport.tx.value;
          gestureStart.ty.value = viewport.ty.value;
        }
      })
      .onUpdate((event) => {
        "worklet";
        if (drag.id.value !== null) {
          drag.dx.value = event.translationX;
          drag.dy.value = event.translationY;
          return;
        }
        viewport.tx.value = gestureStart.tx.value + event.translationX;
        viewport.ty.value = gestureStart.ty.value + event.translationY;
        clamp();
      })
      .onEnd(() => {
        "worklet";
        const id = drag.id.value;
        if (id === null) return;
        const target = hitTargets.value.find((candidate) => candidate.id === id);
        drag.id.value = null;
        if (!target) return;
        const x = target.x + drag.dx.value / viewport.scale.value;
        const y = target.y + drag.dy.value / viewport.scale.value;
        runOnJS(commitMove)(
          id,
          Math.min(Math.max(x, bounds.x), bounds.x + bounds.width),
          Math.min(Math.max(y, bounds.y), bounds.y + bounds.height),
        );
      });

    const pinch = Gesture.Pinch()
      .onStart(() => {
        "worklet";
        gestureStart.scale.value = viewport.scale.value;
        gestureStart.tx.value = viewport.tx.value;
        gestureStart.ty.value = viewport.ty.value;
      })
      .onUpdate((event) => {
        "worklet";
        const start = gestureStart.scale.value;
        const next = Math.min(limits.max, Math.max(limits.min, start * event.scale));
        const factor = next / start;
        // Der Punkt unter den Fingern soll beim Zoomen stehen bleiben.
        viewport.scale.value = next;
        viewport.tx.value = event.focalX - (event.focalX - gestureStart.tx.value) * factor;
        viewport.ty.value = event.focalY - (event.focalY - gestureStart.ty.value) * factor;
        clamp();
      });

    const tap = Gesture.Tap()
      .maxDuration(300)
      .onEnd((event) => {
        "worklet";
        if (placingNow.value) {
          runOnJS(onPlace)({
            x: (event.x - viewport.tx.value) / viewport.scale.value,
            y: (event.y - viewport.ty.value) / viewport.scale.value,
          });
          return;
        }
        const hit = findPlant(event.x, event.y);
        runOnJS(onSelect)(hit ? hit.id : null);
      });

    return Gesture.Simultaneous(Gesture.Race(tap, pan), pinch);
  }, [
    screen,
    viewport,
    drag,
    gestureStart.tx,
    gestureStart.ty,
    gestureStart.scale,
    hitTargets,
    editing,
    placingNow,
    commitMove,
    onSelect,
    onPlace,
  ]);

  // Etiketten werden erst beim Hineinzoomen eingeblendet.
  const labelOpacity = useDerivedValue(() =>
    Math.min(1, Math.max(0, (viewport.scale.value - LABEL_FADE_FROM) / (LABEL_FADE_TO - LABEL_FADE_FROM))),
  );

  const worldTransform = useDerivedValue(() => [
    { translateX: viewport.tx.value },
    { translateY: viewport.ty.value },
    { scale: viewport.scale.value },
  ]);

  return (
    <View style={styles.container} onLayout={onLayout}>
      {screen ? (
        <GestureDetector gesture={gesture}>
          <Canvas style={styles.canvas}>
            <Group transform={worldTransform}>
              <Picture picture={ground} />
              {ordered.map((plant) => (
                <PlantNode
                  key={plant.id}
                  plant={plant}
                  species={speciesOf(plant.speciesId)}
                  scale={viewport.scale}
                  drag={drag}
                  selected={plant.id === selectedId}
                />
              ))}
            </Group>
            {showLabels && font ? (
              <Group opacity={labelOpacity}>
                {ordered.map((plant) => {
                  const species = speciesOf(plant.speciesId);
                  return (
                    <PlantLabel
                      key={plant.id}
                      plant={plant}
                      text={plant.name ?? species.name}
                      font={font}
                      radiusMeters={diameterOf(plant, species) / 2}
                      viewport={viewport}
                      drag={drag}
                    />
                  );
                })}
              </Group>
            ) : null}
            <Compass screen={screen} font={font} />
          </Canvas>
        </GestureDetector>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvasBackground },
  canvas: { flex: 1 },
});
