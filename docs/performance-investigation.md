# AI Battle Performance Investigation

## 1. Symptom

AI-vs-AI battles can occupy the browser for seconds at a time and can take
many seconds or minutes overall. The investigation used seed `1` as the one
representative deterministic slow match after the initial unprofiled samples:

- Seed `1`: approximately `87.7s`, `17,253` outer handler ticks.
- Seed `2`: approximately `190.9s`, `46,878` outer handler ticks.
- Those measurements ran headlessly with no browser renderer.

The profiled seed-1 run took `92.5s`; instrumentation accounts for the small
variation from the unprofiled baseline.

## 2. Execution Path

The actual autonomous path is:

```text
browser p.draw / headless handler.tick
  -> AiBattleSystem.ticker
  -> AiTurnEmitter.executeTurn
  -> HardAi.computeTurn
  -> up to 30 handler.simulateTurn calls
  -> GameHandler.toSettings
  -> JSON clone and GameHandlerBuilder.fromSettings
  -> cloned handler.resolveTurn
  -> up to 1,200 cloned handler.tick calls until isStatic()
  -> candidate scoring
  -> seeded tie-break
  -> GameEmitter.sendShot
  -> one more handler.simulateTurn for the accepted action
  -> playTurn playback on the live handler
  -> next outer handler.tick
```

`GameHandler.resolveTurn` stops only when `PhysicsStrategy.isStatic()` returns
true or the hard limit of `1,200` frames is reached. Static means every entity
velocity component is below `0.1`; the check does not provide a sleep state.

The browser calls `active.tick()` synchronously from `p.draw()`. The AI search
therefore runs inside one browser task; no `requestAnimationFrame`, promise,
timer, or other host yield occurs inside the search.

## 3. Baseline Measurements

Profile command:

```text
bun run scripts/profileAiBattle.ts
```

Seed `1`, one complete deterministic match:

| Metric | Measurement |
| --- | ---: |
| Total wall time | `92,542 ms` |
| Setup | `15 ms` |
| Teardown | `0.1 ms` |
| Turns | `15` |
| AI decisions | `16` |
| AI candidate simulations | `480` |
| Accepted-action simulations | `16` |
| Outer/live handler ticks | `17,253` |
| All handler ticks including clones | `533,399` |
| Candidate/speculative ticks | `498,925` |
| Accepted-action simulation ticks | `17,221` |
| Physics ticks | `533,399` |
| Collision checks | `101,587,834` |
| Collision hits | `15,046` |

The profiler is reusable and intentionally aggregates output. It instruments
runtime prototypes only from the profiling process; it does not alter game
logic.

## 4. AI Search Work Multiplication

| Metric | Seed `1` |
| --- | ---: |
| Turns | `15` |
| AI decisions | `16` |
| Candidates generated/evaluated | `30` per decision / `480` total |
| Candidate simulations | `480` |
| Authoritative accepted-action simulation ticks | `17,221` |
| Speculative AI ticks | `498,925` |
| Speculative share of all handler ticks | `93.5%` |
| Speculative share of simulation ticks | `96.7%` |
| Average ticks per candidate | `1,039.4` |
| Median candidate ticks | `1,200` |
| P95 candidate ticks | `1,200` |
| Maximum candidate ticks | `1,200` |
| Candidates reaching the `1,200` cap | `400 / 480` |
| Minimum candidate ticks | `94` |
| Candidate simulation time | `86,842 ms` |
| Candidate clone/JSON time | `272 ms` |
| Candidate restore/build time | `601 ms` measured in `fromSettings` |
| Accepted-action simulation time | `2,848 ms` |
| Candidate evaluation/scoring overhead | approximately `7 ms` |

The measured cost equation is:

```text
16 AI decisions
× 30 candidates per decision
× 1,039 average ticks per candidate
× approximately 0.174 ms per speculative tick
≈ 86.8 seconds of candidate simulation
```

The broad per-outer-tick average is around `5.36 ms` in this instrumented
run, but that is not the useful unit of explanation. The dominant multiplier
is the number of candidate ticks, not one catastrophic ordinary tick.

## 5. Candidate Tick Distribution

The distribution is not primarily a rare-outlier problem. `400` of `480`
candidates reach the hard `1,200`-tick budget. The median and P95 are both at
the budget. The remaining candidates settle between `94` and below the cap.

This means most candidate simulations either do not become static under the
current rules or take nearly the entire bounded simulation budget. Candidate
evaluation is therefore paying for almost complete physical turns repeatedly.

## 6. Time Attribution

The aggregate instrumentation attributes candidate search, rather than final
playback or setup, as the dominant cost:

- Candidate simulation: `86.8s`.
- Accepted-action simulation: `2.85s`.
- Candidate state clone/restore measured at the explicit branch boundary: under `1s` total.
- Collision check calls: `101.6M`; collision predicate self-time was about `5.0s` in the instrumentation run.
- Physics system aggregate: about `21.5s` across all ticks, including candidate and accepted simulations.
- Collision response itself: about `50ms`; collision detection and repeated solver checks are much more significant than response formulas.
- Candidate scoring: negligible compared with simulation.

A Bun CPU profile of the same workload showed these dominant source signals:

- native `structuredClone`: `58.9%` self samples;
- trigger processing: `27.8s` total samples;
- handler/entity tick paths: roughly `23s` total samples each in the sampled call tree;
- `PhysicsSystem.resolveAllCollisions`: roughly `4.0s` self/total signal depending on call frame;
- collision predicate and overlap bookkeeping were secondary but repeated millions of times.

The structured-clone signal is mostly repeated trigger/effect and canonical
state copying inside every speculative tick, not the one JSON branch clone per
candidate. This is a separate cost multiplier from candidate setup.

## 7. UI Responsiveness Finding

The browser main thread is starved during AI search. A browser heartbeat
instrumentation run installed a `10ms` interval before starting the battle and
recorded:

- elapsed time until the first completed turn: `8,553 ms`;
- maximum interval gap: `4,723.5 ms`;
- interval callbacks observed: `462`.

This confirms two distinct findings:

```text
Throughput: speculative AI work consumes approximately 90 seconds headlessly.
Scheduling: one synchronous browser task can hold the main thread for multiple seconds.
```

Rendering is not the primary throughput cause because the headless workload is
already pathological. A browser scheduling yield could improve pointer and
paint responsiveness without reducing total CPU work or changing deterministic
simulation steps.

## 8. Between-Match Finding

Headless setup and teardown measured approximately `15ms` and `0.1ms` for seed
`1`; there is no fixed sleep or database operation in the local AI battle
transition. The local router creates a fresh handler for a rematch and disposes
the old handler, but that work is negligible relative to candidate search.

In the browser, the result overlay waits for an explicit rematch/menu action.
The browser harness additionally polls with `100ms` to `250ms` intervals. Those
polls can make observed transitions look delayed, but they do not explain the
multi-second battle stalls. The menu preview also runs an autonomous battle
from its normal draw loop, so its reset/setup path is cheap while the preview
simulation itself is expensive.

## 9. Hotspots

1. **P0: Too many speculative ticks.** `480` candidate simulations account for `498,925` ticks, with `400` candidates at the `1,200` cap.
2. **P1: Expensive tick implementation.** Trigger/effect cloning and orchestration are repeated for every speculative tick; physics performs tens of millions of repeated candidate checks.
3. **P1: Synchronous browser scheduling.** A single draw task can block input and paint for approximately `4.7s`.
4. **P2: Candidate branch setup.** JSON snapshotting and runtime restoration are measurable but below `1s` for this match, so they are not the first optimization target.
5. **P3: Rendering and match setup.** Not dominant in the measured workload.

## 10. Optimization Candidates

| Priority | Area | Current Cost | Proposed Change | Expected Benefit | Risk |
| --- | --- | ---: | --- | --- | --- |
| P0 | Candidate count | `30 × 16` simulations | Reduce or adapt search budget | Attacks candidate-count multiplier directly | Changes AI quality and possibly decisions; not implemented |
| P0 | Ticks per candidate | `400 / 480` reach `1,200` | Define a semantics-preserving speculative evaluation bound or prove a valid early-stop criterion | Attacks the dominant tick multiplier | High gameplay/determinism risk; requires qualification |
| P1 | Candidate simulation path | `86.8s` | Separate immutable candidate origin from repeated branch setup, preserving exact state | Removes repeated setup overhead only | Low/moderate, but measured branch setup is not dominant |
| P1 | Per-tick trigger cloning | `structuredClone` dominates CPU samples | Introduce a trusted internal fast path for already-validated transient trigger data, with contract tests | Could materially lower speculative tick cost | Must preserve isolation, validation boundaries, and replay semantics |
| P1 | Browser scheduling | `4.7s` max task gap | Run deterministic simulation in fixed chunks and yield between chunks | Restores pointer/paint responsiveness | Does not improve total CPU; requires isolated browser host orchestration |
| P2 | Collision candidate work | `101.6M` checks | Optimize only after measuring a semantics-preserving broad-phase strategy | Lowers tick cost if validated | Physics correctness and determinism risk |
| P3 | Workers | Not yet measured as boundary solution | Consider only after state-transfer cost and chunking are compared | Main-thread isolation | Serialization and architecture complexity |

## 11. Architecture Impact

- AI candidate budget and evaluation policy belong to `src/ai/` or match composition.
- Speculative simulation lifecycle belongs at the engine/runtime boundary only if it can preserve canonical snapshots and replay behavior.
- Trigger fast paths belong to generic system/contract implementation and require independent contract tests.
- Browser chunking belongs to the browser host/scene scheduler, not deterministic physics.
- Collision broad phase belongs to generic physics only after correctness and determinism qualification.
- No optimization should introduce wall-clock-dependent gameplay `dt`.

## 12. Recommended Order

1. Keep the current profiler and add a deterministic decision trace assertion for any candidate-search changes.
2. Decide whether the product permits a reduced/adaptive AI search budget; this is the highest-impact change but changes AI behavior/quality.
3. If AI quality must remain unchanged, investigate a canonical speculative simulation path that preserves the exact `1,200`-tick result while avoiding repeated transient cloning.
4. Profile and qualify trigger/effect fast paths; this is the clearest measured per-tick implementation hotspot.
5. Add browser-only deterministic chunking/yielding for responsiveness after throughput work is independently measured.
6. Reconsider workers only if the remaining CPU workload still blocks the browser and state-transfer cost is acceptable.

## 14. AI Decision Stability by Simulation Horizon

### Reference

- Seed: `1`
- Map: `ice-map-v1`
- AI: hard vs hard, `maxSimulations: 30`, `maxAngleSamples: 10`, `maxForceSamples: 3`
- Decisions tested: `16`
- Candidates per decision: `30`
- Reference horizon: `1,200` ticks
- The first experimental `1,200` selection matched the production `HardAi.computeTurn()` selection exactly.

Each candidate was simulated once to `1,200` ticks. Its score was sampled at
every requested horizon from that same deterministic trajectory. The accepted
action used the experimental `1,200` selection, so the battle remained on the
same deterministic decision sequence while the shorter horizons were measured.

### Horizon Matrix

The compact action notation is `actor-id-suffix:angle/power`. The suffixes are
the stable tail of the canonical actor IDs in this seed; the full IDs are in
the raw aggregate output. `1200` is the reference column.

| Decision | 100 | 200 | 300 | 400 | 500 | 600 | 800 | 1000 | 1200 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 140:5/4 | 140:357/10 | 140:357/10 | 140:357/10 | 140:357/10 | 140:357/10 | 140:357/10 | 140:357/10 | 140:357/10 |
| 1 | 146:189/10 | 146:189/7 | 146:189/7 | 146:189/7 | 146:189/7 | 146:189/7 | 146:189/7 | 146:189/7 | 146:189/7 |
| 2 | 141:356/4 | 141:70/10 | 141:70/10 | 141:70/10 | 141:70/10 | 141:70/10 | 141:70/10 | 141:70/10 | 141:70/10 |
| 3 | 146:259/10 | 146:27/7 | 146:27/7 | 146:27/7 | 146:27/7 | 146:27/7 | 146:27/7 | 146:27/7 | 146:27/7 |
| 4 | 141:39/7 | 141:39/10 | 141:39/10 | 141:39/10 | 141:39/10 | 141:39/10 | 141:39/10 | 141:39/10 | 141:39/10 |
| 5 | 146:256/10 | 146:256/7 | 146:256/7 | 146:256/7 | 146:256/7 | 146:256/7 | 146:256/7 | 146:256/7 | 146:256/7 |
| 6 | 141:315/4 | 141:315/4 | 141:315/4 | 141:315/4 | 141:315/4 | 141:315/4 | 141:315/4 | 141:315/4 | 141:315/4 |
| 7 | 146:290/7 | 146:290/7 | 146:290/7 | 146:290/7 | 146:290/7 | 146:290/7 | 146:290/7 | 146:290/7 | 146:290/7 |
| 8 | 141:228/4 | 141:228/10 | 141:228/10 | 141:228/10 | 141:228/10 | 141:228/10 | 141:228/10 | 141:228/10 | 141:228/10 |
| 9 | 146:30/7 | 146:30/7 | 146:114/10 | 146:114/10 | 146:114/10 | 146:114/10 | 146:114/10 | 146:114/10 | 146:114/10 |
| 10 | 141:248/10 | 141:248/7 | 141:248/7 | 141:248/7 | 141:248/7 | 141:248/7 | 141:248/7 | 141:248/7 | 141:248/7 |
| 11 | 146:340/7 | 146:340/7 | 146:340/4 | 146:340/4 | 146:340/4 | 146:340/4 | 146:340/4 | 146:340/4 | 146:340/4 |
| 12 | 141:264/10 | 141:264/10 | 141:264/10 | 141:264/10 | 141:264/10 | 141:264/10 | 141:264/10 | 141:264/10 | 141:264/10 |
| 13 | 146:344/7 | 146:344/7 | 146:344/7 | 146:344/7 | 146:344/7 | 146:344/7 | 146:344/7 | 146:344/7 | 146:344/7 |
| 14 | 141:300/4 | 141:264/10 | 141:120/10 | 141:120/10 | 141:120/10 | 141:120/10 | 141:120/10 | 141:120/10 | 141:120/10 |
| 15 | 148:339/7 | 148:339/7 | 148:339/10 | 148:339/10 | 148:339/10 | 148:339/10 | 148:339/10 | 148:339/10 | 148:339/10 |

Exact selected-action agreement against the `1,200` reference:

| Horizon | Same selection | Agreement |
| ---: | ---: | ---: |
| 100 | `4 / 16` | `25.0%` |
| 200 | `12 / 16` | `75.0%` |
| 300 | `16 / 16` | `100.0%` |
| 400 | `16 / 16` | `100.0%` |
| 500 | `16 / 16` | `100.0%` |
| 600 | `16 / 16` | `100.0%` |
| 800 | `16 / 16` | `100.0%` |
| 1000 | `16 / 16` | `100.0%` |
| 1200 | `16 / 16` | reference |

### Score Stability

The changed selections are concentrated at early discrete evaluation events.
For decisions `0` and `6`, the score remained tied and the shorter-horizon
selection changed or stayed fixed through deterministic tie-breaking. For
decisions `2`, `9`, `14`, and `15`, the selected score changed by a discrete
`5,000` or `10,000` participation/elimination increment before settling. No
selection or score change occurred after horizon `300` in this match.

The experiment did not add event labels to the score trace, so it does not
claim whether each participation transition was caused by a specific boundary
or collision. It does establish that no late `300..1200` evaluation event
changed the selected action for this seed.

### Stable Horizon Distribution

The first horizon after which each decision stayed equal to the `1,200`
selection through all measured later horizons was:

- Minimum: `100`
- Median: `200`
- P95: `300`
- Maximum: `300`

### Work Reduction

Natural early termination was retained when estimating each horizon. The
reference speculative work was `498,925` ticks:

| Horizon | Speculative ticks | Reduction | Estimated candidate time |
| ---: | ---: | ---: | ---: |
| 100 | `47,994` | `90.4%` | `8.4s` |
| 200 | `95,435` | `80.9%` | `16.6s` |
| 300 | `138,774` | `72.2%` | `24.2s` |
| 400 | `178,925` | `64.1%` | `31.1s` |
| 500 | `218,925` | `56.1%` | `38.1s` |
| 600 | `258,925` | `48.1%` | `45.1s` |
| 800 | `338,925` | `32.1%` | `59.0s` |
| 1000 | `418,925` | `16.0%` | `72.9s` |
| 1200 | `498,925` | reference | `86.8s` |

Estimated times scale the measured `86.8s` candidate-simulation time by tick
count. They are not production before/after benchmarks. At horizon `300`, the
measured decision agreement is `100%` for this seed while the speculative work
estimate falls by `72.2%`.

### Candidate Search Space

Hard AI constructs, per actor:

```text
(one angle toward each living enemy + 10 rotated grid angles)
× 3 powers [4, 7, 10]
```

With six actors and six enemies, the uncapped nominal space is:

```text
6 actors × (6 enemy angles + 10 grid angles) × 3 powers = 288 candidates
```

`maxSimulations: 30` truncates this before the second actor in the measured
fixture. The actual evaluated set is the first `10` angle entries for the first
eligible actor, each paired with the three powers:

```text
10 angle entries × 3 powers = 30 candidates per decision
```

No item variants or multi-step lookahead are part of this search.

### Late-Decision Analysis

Four decisions changed selection after horizon `100`; three more changed by
horizon `300`, and none changed after `300`. The late changes were accompanied
by discrete score changes or tie-group changes, rather than a gradual ranking
drift. This seed provides evidence for a shorter fixed evaluation horizon for
this map/configuration, but not yet for all maps, items, hazards, or seeds.

### Recommendation

`SHORTER_FIXED_HORIZON_SUPPORTED` for this measured seed and configuration.

`300` ticks is the shortest tested horizon with `100%` exact selection agreement
against the current `1,200` reference, with an estimated `72.2%` reduction in
speculative ticks. This is evidence for a controlled follow-up benchmark, not
permission to change production behavior. More seeds and content configurations
must be tested before adopting `300` globally. An adaptive termination rule may
ultimately be safer if late semantic events appear in those cases.

## 15. Before/After

No optimization other than the isolated Hard AI horizon change was implemented.
The reusable runtime artifacts are `scripts/profileAiBattle.ts` and
`scripts/profileAiDecisionStability.ts`; the actual horizon before/after is
recorded below.

## 16. Production Optimization: 300-Tick Hard AI Horizon

### Production Optimization

Hard AI speculative max horizon:

```text
1200 -> 300
```

Only `HardAi.computeTurn()` passes the explicit `{ maxTicks: 300 }` option.
`GameHandler.simulateTurn()` still defaults to `1,200`, and authoritative
`resolveTurn()` still uses `1,200`.

### Reason

The stability experiment matched the `1,200` reference on `16/16` decisions at
`300` ticks while reducing projected speculative work by `72.2%`.

### Actual Before/After

Same seed (`1`), map, AI configuration, and profiler:

| Metric | Before: 1200 | After: 300 |
| --- | ---: | ---: |
| Total runtime | `92,542 ms` | `34,213 ms` |
| Hard AI decision time | `88,299 ms` | `28,550 ms` |
| Candidate simulation time | `86,842 ms` | `28,544 ms` |
| Speculative ticks | `498,925` | `138,774` |
| Candidate count | `480` | `480` |
| Median candidate ticks | `1,200` | `300` |
| P95 candidate ticks | `1,200` | `300` |
| Budget hits | `400 / 480` at 1200 | `409 / 480` at 300 |
| Accepted-action ticks | `17,221` | `17,221` |
| Accepted-action time | `2,848 ms` | `2,838 ms` |

Measured speedup:

- Total match: `2.70x` faster, `63.0%` less wall time.
- Candidate simulation: `3.04x` faster, `67.1%` less candidate time.
- Speculative ticks: `72.2%` fewer.

The accepted-action path stayed effectively unchanged, including its tick
count. The profiler's `409 / 480` 300-tick budget hits means candidates that
would have continued past 300 were intentionally truncated; this is the
isolated optimization under qualification, not a change to normal physics.

### Qualification Status

- Seed-1 selection parity: `16 / 16`, proven.
- Production Hard AI decisions were compared against the recorded `1,200`
  reference at every one of the `16` decisions.
- Global parity across all gameplay configurations: `not yet proven`.
- Additional seed/map/hazard/item qualification remains required.

Production behavior changed only for speculative Hard AI candidate evaluation.
Candidate generation, scoring, ordering, tie-breaking, physics, snapshots,
replay, and authoritative simulation were not changed.

## Final Diagnosis

```text
Primary bottleneck: TOO_MANY_TICKS_PER_CANDIDATE
Secondary bottleneck: TOO_MANY_CANDIDATES
Additional bottleneck: EXPENSIVE_TICK
UI cause: synchronous event-loop starvation by the same AI search
Between-match cause: not setup/teardown; browser result/polling waits are secondary
```

The current evidence supports:

```text
moderately expensive deterministic simulation
× 480 speculative branches
× nearly 1,040 ticks per branch
= pathological battle runtime
```

Determinism: `PASS` for the measured unchanged runtime path. No gameplay code,
physics rules, thresholds, replay format, or snapshot semantics were changed.
