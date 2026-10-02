import { Action, Kiln, Nix, On } from "@kiln/core"
import { Release } from "@kiln/std"
import { flake } from "./flake.ts"

/** Every flake check of this system, what `nix flake check` built before. */
export const checks = Object.entries(flake.checks).map(([name, ref]) => Nix.build(ref, { name }))

export const release = Nix.build(flake.packages.projectRelease, { name: "release" })

export const promote = Action.make("promote", { needs: { release }, after: checks, grants: { deploy: true } }, function*({ release }) {
  return yield* Release.promote(release)
})

export default Kiln.project({
  rules: [
    On.pullRequest([...checks, release]),
    On.push("main", [promote]),
  ],
})
