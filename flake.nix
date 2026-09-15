{
  description = "Merkbeet – der Gartenplan meiner Eltern";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nix-infra-modules = {
      url = "github:HaukeSchnau/nix-infra-modules/8a2f0de96b2aa8c1d35fda089c3ead92085f034c";
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
      projectDescriptor = builtins.fromJSON (builtins.readFile ./project.json);
      forAllSystems = lib.genAttrs [
        "aarch64-linux"
        "x86_64-linux"
      ];

      mkPackages =
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          inherit (import ./nix/toolchain.nix { inherit pkgs; }) nodejs pnpm;
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
                "devenv.nix"
                "devenv.yaml"
                "devenv.lock"
                "nix/toolchain.nix"
                "README.md"
              ])
              && !(lib.any (prefix: lib.hasPrefix prefix relative) [
                ".expo/"
                ".devenv/"
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
            hash = "sha256-zHAqqgiELHugw1Nex0pRX02qFNl20i7wUvLPmsE8GIU=";
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

          releaseWeb = pkgs.writeShellApplication {
            name = "merkbeet-release-web";
            runtimeInputs = [
              pkgs.bun
              pkgs.coreutils
            ];
            text = ''
              install -d -m 0700 "$MERKBEET_STATE_DIR"
              export MERKBEET_WEB_DIR=${web}
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
          projectRelease = releaseRuntime.package;
        };
    in
    {
      lib.project = projectDescriptor;
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
            cmp ${./project.json} ${packages.projectRelease}/share/project/descriptor.json
            touch $out
          '';
        }
      );
    };
}
