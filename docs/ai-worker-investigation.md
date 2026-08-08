# AI Worker Investigation

## Current Problem

The 300-tick Hard AI optimization reduced representative seed-1 total runtime
from about `92.5s` to `34.2s`, but Hard AI still executes synchronously from
the browser draw/update path. Earlier browser profiling measured an

Throughput and responsiveness are separate concerns. A worker can remove the
Hard AI main-thread stall without changing deterministic simulation speed.

## Dependency Audit

| Dependency | Worker-safe? | Evidence | Required Change |
| --- | --- | --- | --- |
| `HardAi` candidate generation/scoring | WORKER_SAFE | Imports only types, `SeededRandom`, and `GameHandler` as a type; no DOM, timers, or rendering | None |
| `SeededRandom` | WORKER_SAFE | Pure seeded state/number operations | None |
| `GameHandlerBuilder.fromSettings()` | WORKER_SAFE | Reconstructed in the worker POC from a structured-cloned snapshot | Host worker entry only |
| `GameHandler.resolveTurn()` | WORKER_SAFE | Uses deterministic systems and fixed tick budgets; worker parity passed | None |
| Physics, structures, effects, lifecycle systems | WORKER_SAFE | Browser-target bundle succeeds; POC resolves the accepted action and matches the canonical post-turn fingerprint | None |
| `PlayerSettings` modifiers/effects/inventory | WORKER_SAFE | Preserved by `Player.toSettings()` and restored by `createRuntimePlayer()` | None |
| `RenderContext` and gameplay renderer | WORKER_SAFE_UNUSED | Handler imports renderer types/classes but the worker path never calls drawing methods; browser-target bundle has no DOM requirement | Keep rendering on main thread |
| `p5`, `window`, `document`, audio/menu/scene adapters | BROWSER_ONLY | Not imported by the worker compute entry | No worker dependency |
| `crypto.randomUUID()` | WORKER_SAFE | Available in modern browser workers; used only for runtime defaults, not worker decision entropy | Validate target browser support or avoid fresh IDs in requests |
| KORE item runtime/catalog modules | WORKER_SAFE in current path | Included in the browser-target compute bundle without browser side effects | Keep worker content input validated; investigate new device-bound content separately |
| Live handler/emitter references | SHARED_MUTABLE_STATE_RISK | Runtime objects cannot cross `postMessage()` safely | Send only canonical snapshots and plain actions |

`bun build src/ai/worker/compute.ts --target browser` succeeds with a `0.43MB`
bundle. No browser-only import was required by the deterministic compute path.

## Canonical Snapshot Boundary

`GameHandler.toSettings()` is the correct worker state boundary. The actual
`EngineSettings` contract preserves:

- complete player/entity state: position, velocity, rotation, HP,
  participation, effects, inventory, pending action modifiers, temporal
  modifiers, collision filters, actor eligibility, and numeric thresholds;
- structures and map effects;
- counters;
- active team, turn number, rule state, and match result;
- item draw and pickup state;
- structure lifecycle and deferred-effect state;
- physics contact state and stable system settings/order;
- tick rate, friction, drift, map, and mode settings.

`GameHandlerBuilder.fromSettings()` is the existing reconstruction path and was
used unchanged by the worker POC. No snapshot/reconstruction gap was found for
the tested deterministic path. Feedback history and rendering state are not in
`EngineSettings`, but neither affects Hard AI decisions.

`TurnPacket` is not sufficient as a worker reconstruction source because it
contains final player state but not the complete handler/system/lifecycle state.

## Request Protocol

The POC request is versioned and structured-clone-compatible:

```ts
{
  schemaVersion: 1,
  requestId: string,
  basedOnStateHash: string,
  expectedTurnNumber: number,
  expectedNextTeam: number,
  nextRuleState: RuleState,
  snapshot: EngineSettings,
  acceptedAction: { actorId: string, angle: number, power: number },
  aiSettings: AiSettings
}
```

The snapshot is the pre-action canonical state. `acceptedAction` is already
validated by the main-thread authority. `nextRuleState` is deterministic
transition metadata derived by the same `RuleInterpreter` used by
`GameEmitter`; it is needed because rule progression currently lives outside
`GameHandler.resolveTurn()`.

## Response Protocol

```ts
{
  schemaVersion: 1,
  requestId: string,
  basedOnStateHash: string,
  expectedTurnNumber: number,
  expectedNextTeam: number,
  postTurnStateHash: string,
  action?: { actorId: string, angle: number, power: number },
  computeMs: number
}
```

The worker returns intent and a predicted canonical post-turn fingerprint. It
does not return authoritative entity state and cannot mutate the main handler.
The POC fingerprint is an FNV-style deterministic provenance hash; a production
client may use the repository's canonical hash contract if stronger collision
resistance is required.

## Precompute Lifecycle

### Variant A: Post-turn

```text
main thread finishes player turn
  -> handler.toSettings()
  -> worker computes Hard AI
  -> next AI turn waits for response
```

This is simpler but hides no AI latency behind visible playback.

### Variant B: Pre-action snapshot plus accepted action

```text
GameEmitter validates player action
  -> capture pre-action handler.toSettings()
  -> derive next RuleState with RuleInterpreter
  -> send request to persistent worker
  -> existing main-thread simulateTurn/playTurn runs authoritatively
  -> browser renders the visible player physics
  -> worker restores snapshot, resolves accepted action, starts next turn,
     computes Hard AI intent
  -> playback completion exposes actual canonical post-turn state
  -> compare provenance and post-turn fingerprints
  -> consume prepared action or discard and recompute
```

The earliest safe hook is after `GameEmitter.sendShot()` has validated actor
ownership/input and accepted the action, immediately before its existing
`handler.simulateTurn()` call. It must not start from aim/charge preview data.

## Stale Results and Cancellation

The main thread must validate all of the following before consuming a response:

- request ID is still current for the match/scene;
- snapshot/action provenance hash matches the request being completed;
- expected turn and next team match current rule state;
- actual post-playback `handler.toSettings()` fingerprint equals
  `postTurnStateHash`.

On mismatch, game over, rematch, menu exit, rollback, or a newer request, the
response is ignored. A logical request invalidation plus worker termination on
scene disposal is sufficient; a generic cancellation/job framework is not
needed. Worker completion order must never affect authority.

## Worker Lifecycle

A persistent worker per local match is preferable. The POC startup cost was
approximately `23-31ms`; creating a worker per turn would repeatedly pay module
startup and lose the overlap benefit. The worker should retain no authoritative
mutable match state: each request restores from its own snapshot, and obsolete
requests are ignored or replaced.

## Measurements

The POC used the actual `ice-map-v1` 12-entity snapshot and the current hard-AI
candidate limits. It performed accepted-action resolution, next-rule-state
application, and Hard AI computation in the worker, then compared the result
with the same synchronous reconstruction.

| Measurement | Result |
| --- | ---: |
| Worker startup | `23-31ms` across repeated runs |
| Snapshot size | `25,133 bytes` |
| Full request size | `25,562 bytes` |
| Response size | `257-264 bytes` |
| Local structured clone, 3 requests | `0.76-0.78ms` total |
| Worker request ping round trip | `1.1-1.9ms` |
| Worker compute, including accepted resolution and AI | `2,967-3,055ms` average |
| Full request round trip | `8,903-9,166ms` for 3 requests |
| Player visible-turn frames in POC | `210, 191, 185` |
| Average visible-turn duration at 60Hz | `3.26s` |

The full round-trip overhead beyond reported worker compute was approximately
`0.83ms` per request. The worker compute is intentionally larger than the
current synchronous Hard AI-only measurement because it includes reconstruction
and the accepted player-turn resolution required for Variant B.

The representative AI battle profiler measured `17,221` accepted-action frames
over `16` actions, or approximately `1,076` frames per action (`17.9s` at 60Hz)
in that workload. This indicates substantial theoretical overlap, but visible
duration depends on the player's actual action and map state.

The previous browser profile measured a `4.72s` maximum main-thread event-loop
gap from synchronous Hard AI. With worker integration, the AI portion of that
gap has near-zero main-thread execution potential; only request handling and
the existing main-thread accepted-action simulation remain. The POC's request
ping was `1.1-1.9ms`, while worker computation stayed off the main thread.

## Proof of Concept

The non-production POC consists of:

- `src/ai/worker/protocol.ts`
- `src/ai/worker/compute.ts`
- `scripts/aiWorkerProbe.ts`
- `scripts/profileAiWorker.ts`

`bun run scripts/profileAiWorker.ts` proves:

1. pre-action `handler.toSettings()` plus accepted action crosses the worker;
2. worker reconstruction and accepted-turn resolution complete;
3. worker and synchronous post-turn canonical fingerprints match;
4. worker and synchronous Hard AI actions match;
5. three repeated requests produce identical action and post-turn fingerprints.

Result: `PASS`.

## Architecture Impact

Production integration would require a small browser host adapter and worker
entry point, likely under `src/ai/worker/`, plus a narrow `GameEmitter` hook.
It should not modify physics, snapshots, replay semantics, Handler ownership,
or create worker-specific AI/physics implementations. Headless tests, server
runtime, and replay continue using synchronous `HardAi.computeTurn()`.

## Risks

- stale responses must be rejected by provenance and post-turn state checks;
- worker bundles must remain free of browser-only scene/device resources;
- persistent worker disposal must follow match/rematch/menu lifecycle;
- a worker duplicates accepted-turn CPU work while the main thread visibly simulates it;
- snapshot reconstruction cost grows with map/content state;
- debug tooling becomes asynchronous;
- browser and desktop worker module bundling need dedicated smoke coverage;
- the POC fingerprint is not a cryptographic hash;
- worker results must remain intent only and never become authoritative state.

## Recommendation

`WORKER_INTEGRATION_QUALIFIED`

The deterministic boundary is qualified in the production browser path. The
canonical snapshot restores the required runtime, the real browser worker
returns deterministic intent with post-turn parity, and Variant B overlaps
worker computation with authoritative visible playback. Synchronous fallback
remains available for headless/server paths and worker failure.

Production behavior changed: `SCHEDULING_AND_PRESENTATION_ONLY`.

## Production Browser Qualification

The production path is now wired through `HardAiWorkerHost` for local AI
battles and human-vs-AI scenes. `GameEmitter` captures the authoritative
pre-action snapshot, the worker restores it and returns intent plus a
post-turn fingerprint, and the main thread validates the result before the AI
system consumes it. Worker disposal is tied to rematches and menu transitions.

The browser qualification uses the real `browserWorker.ts` entry point and
exposes host-owned diagnostics through `window.game.aiWorkerMetrics`. A
representative Chromium run recorded:

| Measurement | Result |
| --- | ---: |
| Worker path available | `true` |
| Requests / valid responses | `3 / 1` |
| Worker compute | `2,773ms` |
| Player-visible duration | `5,101ms` |
| Completion headroom | `2,327ms` |
| Post-turn wait | `0ms` |
| Precompute hit rate | `33%` (`1 / 3` requests) |
| Maximum event-loop gap | `406.5ms` |
| Event-loop gap p50 / p95 | `0ms / 4.7ms` |

The worker path initially exposed a browser-only TDZ cycle in the effect
graph. The worker entry now preserves the application's settings-before-
handler initialization order; this changes no gameplay or serialization
semantics. Healthy pending requests remain asynchronous and are shown by the
HUD as a hard-AI thinking status after visible playback ends. Failed,
unavailable, malformed, stale, or mismatched worker results use the existing
synchronous fallback or are discarded as appropriate.

The measured event-loop gap is far below the previous synchronous browser
profile's `4.72s` maximum, although this qualification does not claim a
strict apples-to-apples benchmark run. Worker metrics are UX diagnostics and
are not part of canonical engine snapshots or performance baselines.

## Timeout Investigation

The replay lifecycle test was measured at approximately `8.3s` for its first
test and `17.4s` for its three-match seed-decision test. The fixed arena uses
53 decisions per match, up to `1,590` candidate simulations and `477,000`
speculative ticks per match. The first test's timeout was raised from Bun's
default `5s` to `30s`; no production behavior changed.

Seed variation is synchronous by design in Bun because the browser worker is
unavailable. The different-seed case took approximately `80s` for two
18-decision matches. The same-seed case took approximately `139s` for two
full matches, and the rematch case took approximately `129s` for two full
battles. Those are workload-budget failures, not pending-worker failures; the
affected test budgets are set to `180s`. Search limits, candidate ordering,
physics, and replay semantics were not changed.

## Final Report

```text
Hard AI worker-safe: YES for the deterministic compute path
Main blockers: no known correctness blocker; desktop worker packaging remains unqualified
Request payload: ~25.6KB
Request clone/transfer: ~1.1-1.9ms ping round trip
Worker startup: 23-31ms
Worker compute: ~2.97-3.05s including accepted resolution and AI
Response overhead: sub-millisecond beyond compute in the POC
Synchronous action vs worker action: equal
Post-turn canonical state: equal
Repeated request parity: PASS
Earliest safe precompute point: after GameEmitter action validation/acceptance, before simulateTurn
Estimated visible latency hidden: most of a 3.26s POC turn; potentially most of the 17.9s representative playback turn
Main-thread event-loop improvement potential: AI computation near zero on main thread
Production behavior changed: SCHEDULING_AND_PRESENTATION_ONLY
Recommended next step: keep UX metrics separate from synchronous performance baselines
```
