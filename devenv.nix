{ pkgs, ... }:
{
  packages = builtins.attrValues (import ./nix/toolchain.nix { inherit pkgs; });
  env.EXPO_NO_TELEMETRY = "1";

  tasks = {
    "merkbeet:dependencies" = {
      before = [ "devenv:enterShell" ];
      exec = "pnpm install --frozen-lockfile";
      execIfModified = [
        "package.json"
        "pnpm-lock.yaml"
        "pnpm-workspace.yaml"
        "node_modules/.modules.yaml"
      ];
    };
    "merkbeet:assets" = {
      after = [ "merkbeet:dependencies" ];
      exec = "pnpm run setup:web";
      execIfModified = [
        "package.json"
        "pnpm-lock.yaml"
        "public/canvaskit.wasm"
      ];
    };
    "merkbeet:web" = {
      after = [ "merkbeet:assets" ];
      exec = "MERKBEET_BASE_URL= pnpm run build:web";
      # Generated files also participate, so a deleted export is rebuilt.
      execIfModified = [
        "App.tsx"
        "index.ts"
        "app.config.ts"
        "tsconfig.json"
        "package.json"
        "pnpm-lock.yaml"
        ".env*"
        "src/**"
        "assets/**"
        "public/**"
        "dist/**"
      ];
    };
    "merkbeet:check" = {
      after = [ "merkbeet:dependencies" ];
      exec = "pnpm run typecheck && bun test";
    };
  };

  processes.web = {
    after = [ "merkbeet:web" ];
    exec = ''
      export MERKBEET_STATE_DIR="''${MERKBEET_STATE_DIR:-$DEVENV_STATE/data}"
      export MERKBEET_HOST="''${MERKBEET_HOST:-0.0.0.0}"
      export MERKBEET_PORT="''${MERKBEET_PORT:-8787}"
      export MERKBEET_WEB_DIR="''${MERKBEET_WEB_DIR:-$PWD/dist}"
      mkdir -p "$MERKBEET_STATE_DIR"
      exec bun server/index.ts
    '';
  };
}
