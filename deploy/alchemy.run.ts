import * as Fleet from "@schnau/fleet"
import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

/** srv-2 prüft die Platzierung gegen Merkbeets Grant in ~/infra. Die Version selbst bringt Calder. */
export default Alchemy.Stack(
  "Merkbeet",
  { providers: Layer.mergeAll(Fleet.providers(), Cloudflare.providers()), state: Cloudflare.state() },
  Effect.gen(function*() {
    const placement = yield* Fleet.Placement("Release", {
      project: "merkbeet",
      host: "srv-2",
      endpoint: { hostName: "merkbeet.schnau.dev", visibility: "public" },
      secrets: { passcode: "projects/merkbeet/passcode" },
    })
    return { url: placement.url }
  }),
)
