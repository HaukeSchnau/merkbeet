{
  description = "Merkbeet – der Gartenplan meiner Eltern";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nix-infra-modules = {
      url = "github:HaukeSchnau/nix-infra-modules/3d11957d4d1c585578548c9a66a95be4edb4021d";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      nix-infra-modules,
      ...
    }:
    let
      inherit (nixpkgs) lib;
      forAllSystems = lib.genAttrs [
        "aarch64-linux"
        "x86_64-linux"
      ];

      mkPackages =
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          nodejs = pkgs.nodejs_24;
          pnpm = pkgs.pnpm_11.override { nodejs-slim = pkgs.nodejs-slim_24; };
          version = "1.0.0";

          src = lib.cleanSourceWith {
            src = ./.;
            filter =
              path: _type:
              let
                relative = lib.removePrefix ((toString ./.) + "/") (toString path);
              in
              !(lib.elem relative [
                "flake.lock"
                "flake.nix"
                "README.md"
              ])
              && !(lib.any (prefix: lib.hasPrefix prefix relative) [
                ".expo/"
                ".git/"
                ".jj/"
                ".pnpm-store/"
                ".state/"
                "dist/"
                "docs/"
                "node_modules/"
              ]);
          };

          pnpmDeps = pkgs.fetchPnpmDeps {
            pname = "merkbeet-pnpm-dependencies";
            inherit pnpm src version;
            fetcherVersion = 4;
            hash = "sha256-sfF7iDuxFeU3io6krVtCveDFC+yPvsWBkRYLEPT+4gI=";
          };

          # Der Web-Client als statischer Export. Läuft unter dem Basispfad /,
          # weil der Sync-Dienst ihn selbst ausliefert.
          web = pkgs.stdenvNoCC.mkDerivation {
            pname = "merkbeet-web";
            inherit pnpmDeps src version;

            nativeBuildInputs = [
              nodejs
              pkgs.pnpmConfigHook
              pnpm
            ];

            env = {
              pnpm_config_trust_lockfile = "true";
              # Expo darf im Sandbox nicht nach draußen greifen.
              CI = "1";
              EXPO_NO_TELEMETRY = "1";
              EXPO_NO_DEPENDENCY_VALIDATION = "1";
              MERKBEET_BASE_URL = "";
            };
            pnpmInstallFlags = [ "--frozen-lockfile" ];

            buildPhase = ''
              runHook preBuild
              export HOME="$TMPDIR/home"
              mkdir -p "$HOME"
              pnpm exec expo export --platform web --output-dir dist

              # Skia läuft im Browser als CanvasKit. Die wasm-Datei kommt aus dem
              # Paket statt aus dem Repo, damit ihre Version immer zur
              # installierten Bibliothek passt.
              cp "$(node -e 'process.stdout.write(require.resolve("canvaskit-wasm/bin/full/canvaskit.wasm"))')" dist/
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p "$out"
              cp -R dist/. "$out/"
              test -f "$out/index.html"
              test -f "$out/canvaskit.wasm"
              runHook postInstall
            '';
          };

          # Der Sync-Dienst als eine gebündelte Datei. bun build zieht zod mit
          # herein, sodass zur Laufzeit nur noch bun selbst nötig ist.
          service = pkgs.stdenvNoCC.mkDerivation {
            pname = "merkbeet-service";
            inherit pnpmDeps src version;

            nativeBuildInputs = [
              nodejs
              pkgs.bun
              pkgs.pnpmConfigHook
              pnpm
            ];

            env.pnpm_config_trust_lockfile = "true";
            pnpmInstallFlags = [ "--frozen-lockfile" ];

            buildPhase = ''
              runHook preBuild
              export HOME="$TMPDIR/home"
              mkdir -p "$HOME"
              bun build server/index.ts --target=bun --outfile=merkbeet-server.js
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p "$out/lib"
              cp merkbeet-server.js "$out/lib/"
              runHook postInstall
            '';
          };

          # Development-Plan: das projects-System verlangt ihn auch für
          # Projekte, die nur ausgeliefert werden.
          prepareAction = pkgs.writeShellApplication {
            name = "merkbeet-prepare-action";
            runtimeInputs = [
              nodejs
              pnpm
              pkgs.coreutils
            ];
            text = ''
              checkout="$(project-context path checkout)"
              cache_root="$(project-context path cache)"
              install -d -m 0700 "$cache_root/pnpm-store"
              cd "$checkout"

              pnpm install --frozen-lockfile --store-dir "$cache_root/pnpm-store"
              pnpm run setup:web
              MERKBEET_BASE_URL="" pnpm run build:web
            '';
          };

          developmentWeb = pkgs.writeShellApplication {
            name = "merkbeet-development-web";
            runtimeInputs = [
              pkgs.bun
              pkgs.coreutils
            ];
            text = ''
              checkout="$(project-context path checkout)"
              state_root="$(project-context path state)"

              export MERKBEET_STATE_DIR="$state_root/data"
              install -d -m 0700 "$MERKBEET_STATE_DIR"

              export MERKBEET_WEB_DIR="$checkout/dist"
              export MERKBEET_HOST MERKBEET_PORT MERKBEET_PASSCODE_FILE
              MERKBEET_HOST="$(project-context endpoint web listen-host)"
              MERKBEET_PORT="$(project-context endpoint web listen-port)"
              MERKBEET_PASSCODE_FILE="$(project-context secret-file passcode --required)"

              cd "$checkout"
              exec bun server/index.ts
            '';
          };

          developmentRuntime = nix-infra-modules.lib.projectRuntime.mkDevelopment {
            inherit pkgs;
            descriptorPath = ./project.json;
            actions = {
              prepare = prepareAction;
              web = developmentWeb;
            };
          };

          releaseWeb = pkgs.writeShellApplication {
            name = "merkbeet-release-web";
            runtimeInputs = [
              pkgs.bun
              pkgs.coreutils
            ];
            text = ''
              state_root="$(project-context path state)"

              export MERKBEET_STATE_DIR="$state_root/data"
              install -d -m 0700 "$MERKBEET_STATE_DIR"

              export MERKBEET_WEB_DIR=${web}
              export MERKBEET_HOST MERKBEET_PORT MERKBEET_PASSCODE_FILE
              MERKBEET_HOST="$(project-context endpoint web listen-host)"
              MERKBEET_PORT="$(project-context endpoint web listen-port)"
              MERKBEET_PASSCODE_FILE="$(project-context secret-file passcode --required)"

              exec bun ${service}/lib/merkbeet-server.js
            '';
          };

          releaseRuntime = nix-infra-modules.lib.projectRuntime.mkServiceRelease {
            inherit pkgs;
            descriptorPath = ./project.json;
            payloads = [
              service
              web
            ];
            actions.web = releaseWeb;
          };
        in
        {
          default = releaseRuntime.package;
          inherit web service;
          projectRuntime = developmentRuntime.package;
          projectRelease = releaseRuntime.package;
        };
    in
    {
      packages = forAllSystems mkPackages;

      checks = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          packages = mkPackages system;
        in
        {
          release = pkgs.runCommand "merkbeet-release-check" { } ''
            test -f ${packages.web}/index.html
            test -f ${packages.web}/canvaskit.wasm
            test -f ${packages.service}/lib/merkbeet-server.js
            test -x ${packages.projectRelease}/bin/project-release-runtime
            test -x ${packages.projectRuntime}/bin/merkbeet-project-runtime
            cmp ${./project.json} ${packages.projectRelease}/share/project/descriptor.json
            touch $out
          '';
        }
      );
    };
}
