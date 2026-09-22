{
  description = "Merkbeet – der Gartenplan meiner Eltern";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nix-infra-modules = {
      url = "github:HaukeSchnau/nix-infra-modules/c08469c9ed76a0e2223cb6bf1ac624580be6f98c";
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
      src = nix-infra-modules.lib.projectSource {
        root = ./.;
        exclude = [
          "docs"
          "nix/toolchain.nix"
        ];
      };

      mkPackages =
        pkgs:
        let
          inherit (import ./nix/toolchain.nix { inherit pkgs; }) nodejs pnpm;
          version = "1.0.0";

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
        in
        {
          inherit web service releaseWeb;
        };

      project = nix-infra-modules.lib.projectFlake {
        inherit nixpkgs;
        modules = [ ./project.nix ];
        release =
          { pkgs, ... }:
          let
            packages = mkPackages pkgs;
          in
          {
            payloads = [
              packages.service
              packages.web
            ];
            actions.web = packages.releaseWeb;
          };
      };
    in
    project
    // {
      packages = nixpkgs.lib.mapAttrs (
        system: releases:
        let
          packages = mkPackages nixpkgs.legacyPackages.${system};
        in
        releases
        // {
          default = releases.projectRelease;
          inherit (packages) web service;
        }
      ) project.packages;
    };
}
