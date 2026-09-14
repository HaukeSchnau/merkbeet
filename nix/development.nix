# TODO: Replace this pilot adapter with the shared Project/devenv contract after
# Portfolio and Merkbeet prove prepared execution and lifecycle parity.
{ pkgs, devenv }:
let
  inherit (pkgs) lib;
  root = "/tmp/project-devenv";
  config = devenv.lib.mkConfig {
    inherit pkgs;
    inputs = { };
    modules = [
      ../devenv.nix
      {
        devenv = {
          flakesIntegration = lib.mkForce false;
          cli.version = "2.3.1";
          inherit root;
          dotfile = "${root}/.devenv";
          state = "${root}/.devenv/state";
          runtime = "/tmp/devenv-runtime";
          tmpdir = "/tmp";
        };
        task.package = devenv.packages.${pkgs.stdenv.hostPlatform.system}.devenv-tasks;
      }
    ];
  };
  run = pkgs.writeShellScript "merkbeet-devenv-prepared" ''
    set -euo pipefail
    export PATH=${config.devenv.profile}/bin:${
      lib.makeBinPath [
        pkgs.coreutils
        pkgs.findutils
        pkgs.bash
      ]
    }:"$PATH"
    ${lib.concatStringsSep "\n" (
      lib.mapAttrsToList (
        name: value: "export " + name + "=" + lib.escapeShellArg (toString value)
      ) config.env
    )}
    ${config.enterShell}
    exec ${config.task.package}/bin/devenv-tasks run "$@" --task-file ${config.task.config} --cache-dir "$DEVENV_STATE" --runtime-dir "$DEVENV_RUNTIME" --on-idle exit
  '';
in
{
  # The bundle contains the evaluated graph and tool closure. HTTP wake reads
  # live application files at a fixed private path and performs no Nix work.
  action =
    {
      name,
      task,
      bindings ? "",
    }:
    pkgs.writeShellApplication {
      inherit name;
      runtimeInputs = [ pkgs.coreutils ];
      text = ''
        checkout="$(project-context path checkout)"
        cache_root="$(project-context path cache)"
        install -d -m 0700 "$cache_root/devenv"
        export XDG_CACHE_HOME="$cache_root"
        ${bindings}
        exec ${pkgs.bubblewrap}/bin/bwrap --die-with-parent --unshare-pid \
          --bind / / --dev-bind /dev /dev --proc /proc --tmpfs /tmp \
          --bind "$checkout" ${root} --bind "$cache_root/devenv" ${root}/.devenv \
        --chdir "$checkout" -- ${run} ${lib.escapeShellArg task}
      '';
    };
}
