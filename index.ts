import { registerRootComponent } from "expo";
import { Platform } from "react-native";
import "react-native-gesture-handler";

import { loadSkia } from "./src/view/skiaLoader";

/**
 * App wird bewusst lazy geladen: im Browser darf kein Skia-Modul ausgewertet
 * werden, bevor CanvasKit steht. Native registriert direkt, damit die
 * Root-Komponente sicher vor dem ersten Render bereitsteht.
 */
const mount = () => registerRootComponent((require("./App") as typeof import("./App")).default);

if (Platform.OS === "web") void loadSkia().then(mount);
else mount();
