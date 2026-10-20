import { Pnpm, Project } from "@calder-ci/std"
import { flake } from "./flake.ts"

const shell = flake.devShells.ci

export default Project.standard({
  flake,
  placement: {
    shell,
    setup: Pnpm.install({ shell, dir: "deploy" }),
    dir: "deploy",
    env: "cloudflare",
    secrets: { FLEET_TOKEN_FILE: "placement-token" },
  },
})
