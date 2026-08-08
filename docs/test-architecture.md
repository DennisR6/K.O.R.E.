# Test Architecture

The test suite is organized by the guarantee being proved, not by file age or
runtime alone. Every Bun-discoverable test is assigned by `scripts/testLane.ts`;
the runner fails if a lane is empty, and manifest output makes newly discovered
files visible for semantic review. Browser files are a separate Playwright
population.

## Baseline And Inventory

- Baseline commit: `a3a824e`.
- Before consolidation: 347 Bun-discoverable files (335 modern `.test.ts` and
  12 legacy `_test.ts`), 15 Playwright specs, and 984 tests in the old
  exclusion-based `test:fast` lane; latest baseline runtime was 59.7 seconds.
- Current Bun inventory: 332 files after excluding the 15 browser specs.
- Current classification: 196 unit, 54 integration, 71 qualification, and 11
  soak files. The four explicitly blocked qualification files remain in the
  qualification classification but are excluded from the active profile.
- No test file is unclassified. Non-test helpers under `tests/support`, browser
  harness helpers, `auto-play.ts`, `fullGame.ts`, and standalone type fixtures
  are support inputs, not test specs.

## Lanes

| Lane | Purpose | Does not belong here |
|---|---|---|
| `test:unit` | Pure contracts, validation, deterministic math, normalization, and isolated component state | GameHandler/server/browser workflows |
| `test:integration` | Owner/interpreter composition, Handler authority, persistence, replay, server, and system boundaries | Large stochastic sweeps and browser workflows |
| `test:qualification` | Complete qualified Engine-language and official Item semantics, migration boundaries, and release evidence | Maximal fuzz/matrix stress |
| `test:e2e` | Playwright browser, pointer/keyboard, rendering, menu, online, and external runtime behavior | Pure Engine mechanics |
| `test:soak` | Fuzz, seed sweeps, matrices, tournaments, pacing, and performance stability | Ordinary local feedback |
| `test:fast` | Unit + integration + representative qualification smoke | Browser, desktop, full matrices, and long fuzz |
| `test:release` | Shipping composition: typecheck, build, fast, full qualification, AI replay, browser smoke, SDK/examples, and desktop | Maximal soak unless explicitly selected |

## Decision Tree

1. Pure contract or deterministic transition: `unit`.
2. Requires an owner plus an interpreter or authority boundary: `integration`.
3. Proves a complete qualified feature or historical compatibility promise: `qualification`.
4. Requires Chromium or the actual browser/runtime shell: `e2e`.
5. Uses broad stochastic, combinatorial, pacing, or performance coverage: `soak`.

## Profiles And Budgets

- `test:unit`: measured 6.4 seconds; budget 10 seconds.
- `test:integration`: measured 28.0 seconds; budget 30 seconds.
- `test:integration:fast`: excludes only the measured full-match/server
  scenarios used by the fast loop; the complete integration lane remains the
  authoritative boundary.
- `test:qualification`: measured 126.9 seconds; budget 150 seconds for the
  current complete semantic set.
- `test:qualification:fast`: representative official Item and Engine-language smoke coverage.
- `test:qualification:blocked`: explicit candidate/blocked evidence that is not
  part of the active release claim; it must remain discoverable and visible.
- `test:fast`: measured 11.1 seconds; budget 30 seconds. It is no longer an
  exclusion-based broad suite.
- `test:e2e`: separate Playwright budget; browser smoke is the release profile.
- `test:soak`: measured 231.7 seconds for the default 25-game/100-case profile;
  it is intentionally long-running and has no short local budget.
- `test:release`: broad shipping gate; known build/browser operations use their qualified outer bounds.

Default soak profiles remain deterministic. The existing RC/full environment
variables and aliases are preserved for explicit large runs:
`RC_GAME_COUNT`, `PHYSICS_FUZZ_CASES`, `MAP_MATRIX_FRESH`, and
`GAMEPLAY_MATRIX`.

The blocked qualification profile currently contains
`hazard_control_map.test.ts`, `map_qualification_harness.test.ts`,
`structure_control_map.test.ts`, and `symmetric_duel_map.test.ts`. These are
candidate/map evidence tests whose current failures are retained visibly; they
are not silently deleted or converted into passing assertions. Run
`bun run test:qualification:blocked` when investigating that evidence.

## Semantic Coverage Matrix

| Domain | Unit | Integration | Qualification | E2E | Soak |
|---|---|---|---|---|---|
| Lifetime | `lifetime`, modifier contracts | owner advancement | Item expiry consumers | - | - |
| ActionModifier | modifier validation/RNG | accepted-action boundary | Power-Dash, Anker, Vodka-Zero | - | AI action sweeps |
| ActorEligibility | predicate/constraint contracts | Handler authority | Selection Lock consumer | - | AI match fuzz |
| CollisionFilter | relation predicate | Physics boundary | Ghost Mode consumer | - | physics fuzz |
| Stable Structure identity | migration/key helpers | Physics/environment restore | lifecycle/hazard consumers | map workflows | map matrices |
| Movement | capability/math contracts | MovementSystem/Handler | movement Items | pointer action | physics fuzz |
| Participation | state/command contracts | ParticipationSystem | elimination/temporary wall | result flow | match sweeps |
| Replay | format/origin contracts | replay restore/share | AI replay lifecycle | replay viewers | long replay loops |
| Snapshot | settings/roundtrip contracts | persistence/restore | cross-system parity | runtime reload flows | matrix restores |
| AI | emitter/settings/decision contracts | authoritative AI boundary | deterministic replay sample | AI battle browser flow | fuzz/seed sweeps |
| Network | packet/protocol contracts | server authority/database | replay/network parity | online journey | - |
| Items | schemas/targets/inventory | use/economy ownership | all official Items and Wunderkiste | item UI flows | content matrices |

Every qualified Engine-language domain retains direct coverage in at least one
lower-level lane and one consumer/integration or qualification boundary where
the semantics require composition.

## Coverage Rules

- Generic invariants belong at the cheapest complete layer. Item qualification
  proves lowering and Item-specific state, not every generic snapshot or
  lifetime invariant again.
- Historical migration and compatibility tests are retained unless their
  boundary is explicitly retired.
- A test may be removed only with written subsumption evidence naming the
  replacement unit, integration, and/or qualification tests.
- This consolidation removed no semantic test. It corrected stale fixture
  inputs for stable Structure IDs, current schema validation, generic Item
  lowering, and current lifecycle metadata.
- New features should add contract tests, then focused owner/interpreter
  integration, then minimal feature qualification. Add E2E or soak only when
  the guarantee genuinely requires it.
- Deterministic seeds and failure context must remain reproducible.
- Browser tests stay in the Node/Playwright process because Bun browser
  protocol execution is not stable for the full suite. The release `test:e2e`
  command serializes workers (`E2E_WORKERS=1`) because concurrent browser
  harnesses have produced renderer/canvas contention; direct
  `test:browser:full` remains available for diagnostics.

## Before And After

| Lane | Before equivalent | After result | Purpose |
|---|---:|---:|---|
| Unit | mixed into 59.7s fast suite | 711 tests / 6.4s | Pure contracts and component state |
| Integration | exclusion-based and not independently runnable | 151 tests / 28.0s | Owners, authorities, persistence, replay, server |
| Qualification | scattered gate scripts | 346 tests / 126.9s active | Complete qualified semantics |
| E2E | Playwright full, parallel and flaky under contention | 37 tests / 10.2m serialized | Browser/runtime workflows |
| Soak | hidden behind qualification aliases | 3m52s default | 25 AI games plus 100 physics cases |
| Fast | 984 tests / 59.7s | 974 tests / 11.1s | Frequent local feedback |
| Release | SDK-specific composition | passed in 4m25s | Shipping confidence |

No tests were removed or silently dropped. Four stale test boundaries were
corrected to current contracts, and the old exclusion-only `scripts/testFast.ts`
runner was removed after its package/docs references were replaced. The four
blocked map evidence files are separately discoverable and intentionally remain
failing until their documented map evidence is repaired.

## Commands

```text
bun run test:unit
bun run test:integration
bun run test:integration:fast
bun run test:qualification
bun run test:qualification:fast
bun run test:qualification:blocked
bun run test:e2e
bun run test:soak
bun run test:fast
bun run test:release
```

`bun run test:soak:full` selects the maximal configured fuzz/matrix profiles.
The legacy `test:fuzz*`, `test:physics-fuzz*`, `test:maps*`, and
`test:gameplay-*` commands remain discoverable aliases for focused operations.
