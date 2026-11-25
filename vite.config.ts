import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: [
      // Eingebettet, wie upstream es geschrieben hat; der nächste Abgleich ist eine reine Kopie.
      "tools/oxlint/anti-slop/**",
    ],
    sortPackageJson: {},
  },
  lint: {
    ignorePatterns: [
      // Calders eigenes TypeScript-Projekt, mit einem tsconfig-Paket, das hier nicht installiert ist.
      ".calder",
      // Der Alchemy-Stack ist ein eigenes Paket, mit Abhängigkeiten, die hier nicht installiert sind.
      "deploy",
      // Eingebettet, wie upstream es geschrieben hat; upstream lintet und testet es.
      "tools/oxlint/anti-slop",
    ],
    plugins: ["eslint", "oxc", "react", "typescript", "unicorn"],
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
    ],
    categories: {
      correctness: "error",
      perf: "error",
      suspicious: "error",
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",

      "eslint/eqeqeq": "error",
      "react/rules-of-hooks": "error",
      "typescript/consistent-type-imports": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "error",
      "unicorn/prefer-node-protocol": "error",

      "oxc/no-accumulating-spread": "error",
      "anti-slop/no-array-filter-map": "error",
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reduce-accumulator-copy": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-returns": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-readable-spacing": "error",

      // Der gespeicherte Garten (src/state/persistence.ts), die SQLite-Zeilen des Servers und die
      // Sync-Antworten werden nach Prüfungen von Hand mit `typeof` auf ihre Typen gecastet, und die
      // Diagnose tastet Browser-Globals genauso ab. Sie mit zod zu dekodieren, das server/schema.ts
      // schon benutzt, schreibt diese Grenzen neu; darauf warten die Casts unter beiden
      // Assertion-Regeln. 21, 31 und 6 Funde.
      // https://oxc.rs/docs/guide/usage/linter/rules/typescript/no-unsafe-type-assertion.html
      "typescript/no-unsafe-type-assertion": "off",
      // https://github.com/dmmulroy/anti-slop/blob/63dbb09/src/rules/require-safety-comment-for-type-assertion.ts
      "anti-slop/require-safety-comment-for-type-assertion": "off",
      // https://github.com/dmmulroy/anti-slop/blob/63dbb09/src/rules/no-runtime-typeof.ts
      "anti-slop/no-runtime-typeof": "off",

      // Sie verlangt, dass eine Funktion, die auf einem Weg etwas zurückgibt, das auf allen tut, was
      // Reacts Effekt-Callbacks nicht tun; fehlende Rückgaben fängt `noImplicitReturns`. 4 Funde.
      // https://oxc.rs/docs/guide/usage/linter/rules/typescript/consistent-return.html
      "typescript/consistent-return": "off",

      // Der Servertest fragt den Dienst der Reihe nach ab, bis er antwortet. 2 Funde.
      // https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-await-in-loop.html
      "eslint/no-await-in-loop": "off",

      // Eine kleine Hilfe neben ihrem einzigen Aufrufer liest sich besser als eine hochgezogene. 1 Fund.
      // https://oxc.rs/docs/guide/usage/linter/rules/unicorn/consistent-function-scoping.html
      "unicorn/consistent-function-scoping": "off",

      // Kleine unveränderliche Updates lesen sich als Spread besser als als Mutation. 1 Fund.
      // https://oxc.rs/docs/guide/usage/linter/rules/oxc/no-map-spread.html
      "oxc/no-map-spread": "off",

      // Sie drängt zu `toSorted`, das Hermes nicht hat. 3 Funde.
      // https://oxc.rs/docs/guide/usage/linter/rules/unicorn/no-array-sort.html
      "unicorn/no-array-sort": "off",

      // Zwei Effekte setzen Zustand zurück, wenn sich ihre Eingabe ändert: die abgelegte Pflanze,
      // sobald sie angekommen ist (GardenCanvas.tsx), und die Felder der Pflanzenkarte, wenn sie eine
      // andere Pflanze zeigt (PlantSheet.tsx). Das ins Rendern oder in ein Remount per key zu
      // verlegen, ändert die Gesten und das Sheet. 2 und 2 Funde.
      // https://oxc.rs/docs/guide/usage/linter/rules/react/set-state-in-effect.html
      "react/set-state-in-effect": "off",
      // https://oxc.rs/docs/guide/usage/linter/rules/react/exhaustive-effect-dependencies.html
      "react/exhaustive-effect-dependencies": "off",

      // Gesture Handler und Skia bauen mit großgeschriebenen Fabriken (`Gesture.Pan()`,
      // `Skia.XYWHRect()`), die sie für als Funktion aufgerufene Komponenten hält. 8 Funde.
      // https://oxc.rs/docs/guide/usage/linter/rules/react/capitalized-calls.html
      "react/capitalized-calls": "off",

      // Styles in React Native sind Objekte oder Arrays davon. 4 Funde.
      // https://oxc.rs/docs/guide/usage/linter/rules/react/style-prop-object.html
      "react/style-prop-object": "off",

      // Die automatische JSX-Runtime braucht keinen React-Import. 128 Funde.
      // https://oxc.rs/docs/guide/usage/linter/rules/react/react-in-jsx-scope.html
      "react/react-in-jsx-scope": "off",
    },
    overrides: [
      {
        // Die Skia-Probe fängt Fehler um ihre Leinwand absichtlich mit try/catch, damit ein Absturz
        // als Befund erscheint. Die Regel hat recht, dass Fehler beim Rendern daran vorbeigehen; eine
        // eigene Error Boundary ist ein Folgeschritt. 2 Funde.
        // https://oxc.rs/docs/guide/usage/linter/rules/react/error-boundaries.html
        files: ["src/ui/SkiaProbe.tsx"],
        rules: { "react/error-boundaries": "off" },
      },
      {
        // Das Skia-Paket bringt seine Deklarationen doppelt mit, und die CanvasKit-API der Vorschau
        // ist die commonjs-Kopie; der Cast über `unknown` verbindet beide (skia-node.ts). 1 Fund.
        // https://github.com/dmmulroy/anti-slop/blob/63dbb09/src/rules/no-chained-type-assertions.ts
        files: ["scripts/preview/skia-node.ts"],
        rules: { "anti-slop/no-chained-type-assertions": "off" },
      },
      {
        // Die Felder der Pflanzenkarte sind Native State von @expo/ui. Dessen Web-Polyfill kennt nur
        // `.value`, nicht das `set()`, das die Regel will, und Merkbeet läuft auch im Browser. 5 Funde.
        // https://oxc.rs/docs/guide/usage/linter/rules/react/immutability.html
        files: ["src/ui/PlantSheet.tsx"],
        rules: { "react/immutability": "off" },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
