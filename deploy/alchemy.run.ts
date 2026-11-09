import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Fleet from "@schnau/fleet"
import * as Alchemy from "alchemy"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

/** srv-2 prüft die Platzierung gegen Merkbeets Grant in ~/infra. Die Version selbst bringt Calder. */
export default Alchemy.Stack(
  "Merkbeet",
  {
    providers: Layer.mergeAll(Fleet.providers(), Cloudflare.providers()),
    // Der State Store der Flotte. Nur Alchemy ab beta.85 darf ihn nutzen:
    // ältere Versionen können seinen Schlüssel ersetzen.
    state: Cloudflare.state({ workerName: "alchemy-state-store-fleet" }),
  },
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
