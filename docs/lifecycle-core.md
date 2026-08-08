# Lifecycle Core Consolidation

Baseline: `32e50e2 feat(engine): qualify power dash action modifiers`

## Decision

Variant B was selected: shared flat lifetime fields plus pure helper functions.

The shared core contains only:

- `durationUnit`: `turns` or `ticks`
- `duration`: positive safe integer
- `remaining`: positive safe integer not greater than `duration`
- pure one-step advancement returning a detached next value or `undefined` at expiry

The current flat serialized fields remain unchanged. No schema migration or nested lifetime representation was introduced.

Variant A was rejected as too little consolidation. Variant C was rejected because nested state would create snapshot/replay churn without material benefit. Variant D was rejected because it would collapse distinct ownership and expiry semantics into a hidden scheduler-like record.

## Ownership

| Semantic | Canonical owner | Unit | Advancement | Expiry |
|---|---|---|---|---|
| `TemporalModifier` | Entity/Player `temporalModifiers` | turns | `GameHandler.setTurnNumber()` | Remove modifier |
| `StructureLifecycle` | Handler/world `structureLifecycles` | turns | `GameHandler.setTurnNumber()` | Disable Structure participation, retain Structure |
| `DeferredEffect` | Handler `deferredEffects` | ticks | `GameHandler.tick()` before entity/system processing | Remove record, dispatch exactly once |
| `PendingActionModifier` | Entity/Player `pendingActionModifiers` | action uses | Accepted action boundary | Consume action modifier |

`PendingActionModifier.remainingUses` is deliberately not part of the lifetime core. Lifetime countdown and action-use consumption are separate dimensions.

## Shared Contract

`src/engine/contracts/lifetime.ts` provides `DurationUnit`, `LifetimeSettings`, `createLifetime()`, `validateLifetime()`, and `advanceLifetime()`.

The helper is pure and does not mutate entities, structures, Handler state, schedules, or events. It does not dispatch expiry behavior and does not decide when turns or ticks advance.

## Invariant Audit

- **Invariant:** Trigger is activation timing, lifetime is duration state, and effect/command is the requested transition. **Evidence:** trigger definitions and transient `schedule.due` events remain separate from the three lifetime settings. **Status:** PASS. **Required action:** None.
- **Invariant:** Each lifecycle has one authoritative countdown owner. **Evidence:** Player owns TemporalModifier state; Handler owns StructureLifecycle and DeferredEffect collections; no duplicate countdown fields were added. **Status:** PASS. **Required action:** None.
- **Invariant:** Turns and ticks remain distinct. **Evidence:** TemporalModifier/StructureLifecycle validators accept only `turns`; DeferredEffect accepts only `ticks`; Handler retains separate turn and tick advancement methods. **Status:** PASS. **Required action:** None.
- **Invariant:** Expiry behavior remains semantic-specific. **Evidence:** Player removes TemporalModifiers, Handler disables and retains Structures, and DeferredEffect records are removed before dispatch. **Status:** PASS. **Required action:** None.
- **Invariant:** No universal scheduler or automatic expiry dispatch exists. **Evidence:** `advanceLifetime()` returns only data or `undefined`; owners still perform all effects and dispatch. **Status:** PASS. **Required action:** None.
- **Invariant:** No hidden runtime-only countdown state exists. **Evidence:** all three lifecycle settings and the shared fields are JSON-safe and snapshot-restored. **Status:** PASS. **Required action:** None.
- **Invariant:** No transient `schedule.due` event is authoritative state. **Evidence:** only `deferredEffects` are serialized; due events are created and consumed inside the tick boundary. **Status:** PASS. **Required action:** None.
- **Invariant:** No Item-specific terminology enters the shared core. **Evidence:** `lifetime.ts` contains only generic duration units and countdown fields. **Status:** PASS. **Required action:** None.
- **Invariant:** No lifetime owner advances a unit it does not own. **Evidence:** only Handler turn/tick boundaries call the higher-level `advance*` wrappers; the generic helper has no clock or ticker. **Status:** PASS. **Required action:** None.
- **Invariant:** No wall-clock time or randomness influences lifecycle execution. **Evidence:** the shared core is deterministic arithmetic over canonical values. **Status:** PASS. **Required action:** None.
- **Invariant:** `TemporalModifier` does not become `DeferredEffect`, `DeferredEffect` does not become a persistent modifier, and `StructureLifecycle` does not become a generic object lifetime manager. **Evidence:** public contracts, payloads, owners, and expiry handlers remain separate. **Status:** PASS. **Required action:** None.
- **Invariant:** Existing snapshots and replay documents retain their shape and behavior. **Evidence:** flat fields remain `durationUnit`, `duration`, and `remaining`; focused lifecycle and replay tests pass. **Status:** PASS. **Required action:** None.

## Consumer Impact

- **Freeze-Shot:** Runtime and authoring semantics are unchanged; only duration validation and decrement arithmetic are shared.
- **Mini-Wall:** Runtime and authoring semantics are unchanged; Structure retention and participation expiry remain Handler-owned.
- **Delayed Mine:** Runtime and authoring semantics are unchanged; tick timing, position binding, due removal, and exactly-once dispatch remain Handler-owned.
- **Power-Dash:** Not a lifetime consumer; `remainingUses` remains action-bound and separate.
- **Future Anker:** May later combine the accepted-force operation with a lifetime policy if characterization proves that requirement. It is not changed here.

## Verification

The generic lifetime contract covers units, duration one, duration two, invalid bounds, and immutability. Existing TemporalModifier, StructureLifecycle, DeferredEffect, Freeze-Shot, Mini-Wall, Delayed Mine, snapshot, and replay coverage remains active.
