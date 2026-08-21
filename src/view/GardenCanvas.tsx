// Direkt aus dem Unterpfad: der Paketindex zieht sonst alle 16 Schnitte
// in das Bundle (rund 2 MB), von denen nur dieser gebraucht wird.
import { Nunito_700Bold } from "@expo-google-fonts/nunito/700Bold";
import {
  Canvas,
  Circle,
  Group,
  Path,
  Picture,
  RoundedRect,
  Skia,
  Text,
  createPicture,
  useFont,
  type SkFont,
  type SkPicture,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { GARDEN_PLAN } from "../garden/plan";
import { speciesOf, type Species } from "../garden/species";
import type { Plant, PlantId, Point } from "../garden/types";
import { colors } from "../ui/theme";
import {
  createGroundAnnotationsPicture,
  createGroundFlatPicture,
  createGroundTexturePicture,
} from "./ground";
import { createPlantPicture } from "./plantArt";
import { textWidth } from "./text";
import { clampTranslation, resetViewport, scaleLimits, useViewport, type Screen } from "./viewport";

/** Mindestradius eines Antippziels in Pixeln -- kleine Pflanzen bleiben treffbar. */
const MIN_TOUCH_RADIUS = 24;

/**
 * Ab welcher Zoomstufe (Pixel pro Meter) Etiketten und Bodentextur gezeichnet
 * werden. In der Übersicht überlagern sich die Namen ohnehin, und die Textur
 * ist zu klein, um etwas beizutragen -- genau dort ist aber der ganze Garten
 * im Bild und damit am teuersten. Die zwei Schwellen bilden eine Hysterese,
 * damit es an der Grenze nicht flackert.
 */
const DETAIL_ON = 52;
const DETAIL_OFF = 44;

type HitTarget = { id: PlantId; x: number; y: number; r: number };

type DragState = {
  id: SharedValue<PlantId | null>;
  dx: SharedValue<number>;
  dy: SharedValue<number>;
};

const diameterOf = (plant: Plant, species: Species) => plant.diameterMeters ?? species.defaultDiameterMeters;

/** Bild einer Pflanze, zwischengespeichert -- es haengt nur an Art und Groesse. */
const usePlantPictures = (plants: Plant[]): Map<PlantId, SkPicture> =>
  useMemo(() => {
    const pictures = new Map<PlantId, SkPicture>();
    for (const plant of plants) {
      const species = speciesOf(plant.speciesId);
      pictures.set(plant.id, createPlantPicture(species, diameterOf(plant, species), plant.id));
    }
    return pictures;
  }, [plants]);

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
  // Beim Hineinzoomen kommen Textur und Etiketten dazu. Als React-Zustand,
  // damit die Knoten in der Übersicht gar nicht erst existieren.
  const [detailed, setDetailed] = useState(false);
  // Wer gerade geschoben wird, wird aus dem Sammelbild ausgenommen und einzeln
  // gezeichnet. Wechselt nur bei Beginn und Ende einer Geste.
  const [draggedId, setDraggedId] = useState<PlantId | null>(null);
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
  const groundFlat = useMemo(() => createGroundFlatPicture(), []);
  const groundTexture = useMemo(() => createGroundTexturePicture(), []);
  const groundAnnotations = useMemo(() => createGroundAnnotationsPicture(font), [font]);
  const plantPictures = usePlantPictures(plants);

  // Von Nord nach Sued zeichnen, damit vordere Pflanzen die hinteren ueberdecken.
  const ordered = useMemo(() => [...plants].sort((a, b) => a.position.y - b.position.y), [plants]);

  /**
   * Alle ruhenden Pflanzen in einem einzigen Bild.
   *
   * Vorher war jede Pflanze ein eigener Skia-Knoten mit eigenem Derived Value.
   * Die wurden bei jeder Zoom- und Schiebebewegung alle neu aufgezeichnet --
   * fünfzig Knoten pro Frame, obwohl sich an den Pflanzen nichts ändert. Jetzt
   * wird nur neu gebaut, wenn sich die Pflanzen wirklich ändern oder eine
   * angehoben wird.
   */
  const restingPlants = useMemo(
    () =>
      createPicture((canvas) => {
        for (const plant of ordered) {
          if (plant.id === draggedId) continue;
          const picture = plantPictures.get(plant.id);
          if (!picture) continue;
          canvas.save();
          canvas.translate(plant.position.x, plant.position.y);
          canvas.drawPicture(picture);
          canvas.restore();
        }
      }, Skia.XYWHRect(GARDEN_PLAN.bounds.x, GARDEN_PLAN.bounds.y, GARDEN_PLAN.bounds.width, GARDEN_PLAN.bounds.height)),
    [ordered, draggedId, plantPictures],
  );

  const draggedPlant = draggedId ? plants.find((plant) => plant.id === draggedId) ?? null : null;
  const draggedTransform = useDerivedValue(() => {
    const base = draggedPlant?.position ?? { x: 0, y: 0 };
    return [
      { translateX: base.x + drag.dx.value / viewport.scale.value },
      { translateY: base.y + drag.dy.value / viewport.scale.value },
    ];
  });

  const selected = selectedId ? plants.find((plant) => plant.id === selectedId) ?? null : null;
  const selectionRadius = selected
    ? diameterOf(selected, speciesOf(selected.speciesId)) / 2 + 0.14
    : 0;
  const ringWidth = useDerivedValue(() => 2.5 / viewport.scale.value);

  useEffect(() => {
    editing.value = editMode;
  }, [editMode, editing]);

  useEffect(() => {
    placingNow.value = placing;
  }, [placing, placingNow]);

  // Nur beim Über- und Unterschreiten der Schwellen wird der Zustand gesetzt,
  // nicht bei jedem Frame.
  useAnimatedReaction(
    () => viewport.scale.value,
    (scale) => {
      if (scale >= DETAIL_ON) runOnJS(setDetailed)(true);
      else if (scale <= DETAIL_OFF) runOnJS(setDetailed)(false);
    },
    [],
  );

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
          runOnJS(setDraggedId)(hit.id);
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
        const dx = drag.dx.value;
        const dy = drag.dy.value;
        // Versatz sofort löschen: der Zustandswechsel im JS kommt einen Frame
        // später, und bis dahin würde die Pflanze sonst um den alten Versatz
        // neben ihrer neuen Position stehen.
        drag.id.value = null;
        drag.dx.value = 0;
        drag.dy.value = 0;
        runOnJS(setDraggedId)(null);
        if (!target) return;
        const x = target.x + dx / viewport.scale.value;
        const y = target.y + dy / viewport.scale.value;
        runOnJS(commitMove)(
          id,
          Math.min(Math.max(x, bounds.x), bounds.x + bounds.width),
          Math.min(Math.max(y, bounds.y), bounds.y + bounds.height),
        );
      })
      // Bricht die Geste ab (zweiter Finger, Anruf), bleibt sonst eine Pflanze
      // aus dem Sammelbild ausgenommen und schwebt am Versatz fest.
      .onFinalize(() => {
        "worklet";
        if (drag.id.value === null) return;
        drag.id.value = null;
        drag.dx.value = 0;
        drag.dy.value = 0;
        runOnJS(setDraggedId)(null);
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
              <Picture picture={detailed ? groundTexture : groundFlat} />
              <Picture picture={groundAnnotations} />
              <Picture picture={restingPlants} />
              {draggedPlant && plantPictures.get(draggedPlant.id) ? (
                <Group transform={draggedTransform}>
                  <Picture picture={plantPictures.get(draggedPlant.id)!} />
                </Group>
              ) : null}
              {selected ? (
                <Circle
                  cx={selected.position.x}
                  cy={selected.position.y}
                  r={selectionRadius}
                  color={colors.accent}
                  style="stroke"
                  strokeWidth={ringWidth}
                />
              ) : null}
            </Group>
            {showLabels && detailed && font
              ? ordered.map((plant) => {
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
                })
              : null}
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
