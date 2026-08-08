# Item Convergence

Final Item Convergence checkpoint: `039f914 feat(engine): qualify actor eligibility constraints`.

Repository state: all official Items are now qualified or explicitly retained KORE semantics; no unqualified official Item remains.

CocoIndex state: refreshed after the final qualification slice; current index contains 734 files and 7,403 chunks.

This is the current repository-backed checkpoint, not a historical ranking. Future slices must refresh evidence and rerank all remaining official Items before selecting the next Item.

## Classification

- **A**: Mostly existing primitives; high-value migration.
- **B**: Existing primitives plus one small reusable missing primitive.
- **C**: Substantial generic infrastructure required.
- **D**: Intentionally KORE-specific semantic; retain for now.
- **E**: Already converged.
- **F**: Incomplete or non-production behavior.
- **G**: Deferred pending future primitive evolution.

## Completed / Converged Items

| Item | Canonical lowering | Status | Notes |
|------|--------------------|--------|-------|
| Falltür | `spawnTrigger` -> Engine composition -> stable structure target -> `transform.set-position` + `participation.*` | E | Complete; intentionally deferred for the final drift audit. |
| Freeze-Shot | `TemporalModifier` -> `movement.scale-speed` | E | Persistent stable entity target and deterministic turn expiry. |
| Mini-Wall | `StructureLifecycle` -> canonical dynamic Structure | E | Timed participation expiry retains the dormant structure. |
| Delayed Mine | `DeferredEffectSettings` -> `schedule.due` -> `movement.apply-force-field` | E | Handler-owned deterministic tick lifecycle, stable position target, and shared predefined dispatcher. |
| Magnet | Stable selected entity + canonical origin -> `movement.apply-force-to-entity` -> shared predefined dispatcher -> `MovementSystem` | E | Entity-scoped radial force; no unrelated in-range entity mutation; legacy `EffectMagnet` path removed. |
| Switch | Two stable entity IDs -> `transform.swap-position` -> shared predefined dispatcher -> `TransformSystem` | E | Atomic read-before-write position exchange; no partial mutation; legacy `EffectSwapPosition` path removed. |
| Power-Dash | `pendingActionModifiers` -> accepted `force.scale` -> `PhysicsStrategy.applyImpulse()` | E | One-shot factor 1.5; consumed at the shared accepted-action boundary with snapshot/replay/AI parity. |
| Anker | `pendingActionModifiers` -> accepted `force.scale` + flat turn lifetime | E | Factor 0.5 applies across two qualified turn intervals; lifetime expiry and action consumption remain separate. |
| Vodka-Zero | `pendingActionModifiers` -> accepted `aim.random-offset` -> `PhysicsStrategy.applyImpulse()` | E | One-shot seeded additive angle offset; canonical random state advances only after an accepted action. |

## Current Ranking

Already-converged Items are excluded from this active ranking.

Selection Lock qualified the narrow actor-eligibility extension of the accepted-action authority boundary. The active unqualified ranking is empty.

| Rank | Item | Classification | Existing primitives reused | Missing semantic | Legacy removal value | Risk | Recommendation |
|------|------|----------------|----------------------------|------------------|----------------------|------|----------------|
| -- | Wunderkiste | D | Item economy, seeded draws, stable actor identity, deterministic utility | Reward-pool interpretation and one-Item grant remain KORE meaning | None justified | Low | Qualified retained; not a migration candidate |

## Remaining Item Inventory

The inventory below covers the qualified and retained Items relevant to the current catalog checkpoint from `createOfficialItemLoader()`.

| Item | Production consumer | Current runtime path | Target / phase | Lifecycle/state | Reusable primitives | Gap / classification |
|------|---------------------|----------------------|----------------|-----------------|---------------------|---------------------|
| Durchlässigkeit | `PhysicsSystem` pair eligibility boundary | Declarative `ghostMode` -> entity-owned `collisionFilters` + separate `collisionFilterLifetimes`; legacy `EffectGhostMode` retained only for historical/helper compatibility | Self / Item phase | Two-turn filter lifetime; excludes `entity` and `structure` relations | Collision filter contract, lifetime core, canonical Player state | Qualified; E |
| Jägermeister-Elixier | Shared actor eligibility boundary | Declarative `selectionLock` -> entity-owned `actorEligibilityConstraints` + separate turn lifetimes; legacy `EffectSelectionLock` retained only for historical/helper compatibility | Enemy entity / Item phase | Two-turn actor exclusion; target eligibility remains independent | Actor eligibility contract, lifetime core, canonical Player state, shared validation | Qualified; E |
| Vodka-Zero | Shared accepted-action boundary | Declarative `aimVariance` -> canonical `aim.random-offset`; legacy `EffectAimVariance` retained only for historical/helper compatibility | Self / Item phase | One accepted shot; `remainingUses: 1`; no time lifetime | Pending action state, seeded random primitive, stable modifier ordering | Qualified; E |
| Wunderkiste | `GameHandler.resolveMysteryBoxUse()` plus reward resolver and inventory economy | Declarative `spawnTrigger` declaration with a special Handler reward branch | Self / Item phase | Deterministic reward ID, recursion guard, per-game inventory cap | Item economy, seeded draw state, stable actor identity, scheduling concepts | Reward selection/grant remains KORE content semantics; D |

## Evidence Notes

- The official catalog is authored in `src/item/officialItems.ts` and loaded by `createOfficialItemLoader()`.
- The production Item boundary is `GameHandler.useItem()` and `applyItemEffects()` in `src/engine/Handler.ts`.
- `movement.apply-force-field` remains the area-wide Delayed Mine command; `movement.apply-force-to-entity` is the explicit selected-entity command used by Magnet.
- `transform.set-position` is defined in `src/engine/sdk/transformCapability.ts`; `effect.composition` is ordered but does not provide read-before-write binding.
- `participation.*` controls physics/drawing participation and must not be treated as Ghost Mode collision filtering.
- The gameplay qualification suite intentionally keeps `effect-disappears-after-use` visible for incomplete Item paths rather than promoting them to qualified behavior.
- Wunderkiste uses `resolveMysteryBoxReward()` for KORE reward semantics and delegates the actual one-use capped inventory mutation to `addDrawnInventoryItem()`.
- `MapPickupSystem` is adjacent infrastructure: it grants declared world pickups through the same inventory helper but does not resolve Wunderkiste rewards.
- The Handler special case is legitimate KORE orchestration, not a duplicated generic Engine reward mechanism. No generic reward command or reward graph is justified by another production consumer.

## Next Item

No next Item is selected. All official Items are classified; further work belongs to a separate final drift/test-consolidation pass.

Current order: none.

Qualified Wunderkiste ownership:

```text
KORE reward configuration and validation
-> deterministic seeded reward resolution
-> existing generic addDrawnInventoryItem() grant
-> snapshot/replay through canonical inventory state
```

Missing generic primitive: none. A generic reward/inventory command would be speculative and should not be introduced solely to remove the Item name.

Required characterization:

- Specific and seeded candidate-pool rewards remain deterministic.
- Unknown and recursive rewards remain rejected according to configuration.
- Exactly one capped inventory use is granted.
- Snapshot and replay preserve the reward result.
- No speculative generic reward subsystem is introduced.

## Active Convergence Status

Power-Dash, Anker, Vodka-Zero, Ghost Mode, and Selection Lock are qualified through generic Engine contracts. Wunderkiste remains a qualified retained KORE semantic.

## Final Drift Audit

Already-converged Items must not be opportunistically rewritten during active convergence. Falltür is especially deferred and remains reserved for the separate final drift audit.

After all intended Item slices are complete, perform one final drift audit against the completed Engine/KORE primitive set. The audit must verify that each completed lowering still uses the current generic contracts and that no Item-specific runtime branch has reappeared.

Audit result refreshed for the Ghost Mode qualification slice:

- Falltür uses the generic `spawnTrigger` schedule, validated stable structure targets, ordered Engine compositions, and generic transform/participation dispatch. Its dormant canonical structure and collision binding are data configuration, not a Falltür-specific runtime effect.
- Freeze-Shot uses the generic `TemporalModifier` lifecycle and `movement.scale-speed` command. Its target, expiry, stacking, snapshot, and replay behavior remain covered.
- Mini-Wall uses the generic `StructureLifecycle` host and canonical Structure participation flags. Expired structures remain retained and dormant as required by the current lifecycle contract.
- Verzögerte Mine uses the generic `DeferredEffectSettings` tick scheduler and `movement.apply-force-field` dispatcher path. The area-wide force-field behavior is distinct from selected-entity Magnet behavior.
- Magnet uses the generic selected-entity `movement.apply-force-to-entity` command with the actor position as origin. It does not retain a legacy Magnet runtime path or mutate unrelated entities in range.
- Switch uses the generic `transform.swap-position` command and captures both positions before either write. It does not retain a legacy Switch runtime path.
- Wunderkiste retains only KORE-specific reward-pool interpretation and deterministic reward selection. The actual capped inventory mutation uses the shared inventory grant primitive; no generic reward subsystem is justified.
- Ghost Mode uses entity-owned generic collision filters with separate turn lifetimes. `PhysicsSystem` filters entity/structure pairs before resolution and entry dispatch; boundary elimination remains independent.

No current executable Ghost Mode Item branch remains; `EffectGhostMode` is retained only for historical/helper compatibility and migration lowers old state into canonical filter/lifetime records.

## Negative Invariant Audit

The explicit negative-invariant audit was rerun after the final drift audit. Evidence is from the current source and focused characterization tests, not architectural assumption.

### Global Invariants

- **Invariant:** No Item-specific Engine System exists for a converged Item. **Evidence:** `src/systems/` contains generic Movement, Transform, Participation, and lifecycle hosts; no converged-Item system or Item-specific system ID exists. **Status:** PASS. **Required action:** None.
- **Invariant:** No converged Item directly mutates runtime state from `GameHandler`. **Evidence:** Magnet, Switch, Falltür, Freeze-Shot, Mini-Wall, and Delayed Mine lower to generic commands or lifecycle records; `Handler` only retains KORE reward orchestration for Wunderkiste. **Status:** PASS. **Required action:** None.
- **Invariant:** No converged Item bypasses `dispatchPredefinedEffect()` where a generic command exists. **Evidence:** `Handler.applyItemEffects()` dispatches Magnet and Switch; delayed execution dispatches through the predefined host; Falltür uses validated Engine compositions. **Status:** PASS. **Required action:** None.
- **Invariant:** No runtime object reference is stored in canonical settings. **Evidence:** lifecycle, target, trigger, and effect contracts validate JSON-shaped IDs and payloads; snapshots use `toSettings()` and detached clones. **Status:** PASS. **Required action:** None.
- **Invariant:** No array index is used as stable identity. **Evidence:** Item, entity, structure, lifecycle, deferred, and trigger identities are string IDs; transient activation sequence/index values are not persisted identities. **Status:** PASS. **Required action:** None.
- **Invariant:** No hidden randomness or wall-clock timer influences deterministic Item gameplay. **Evidence:** official reward and pickup helpers now use `seed ?? 0`; Handler derives the Wunderkiste seed from snapshot-stable values. Scene-level random match seed generation is explicit input initialization, not hidden runtime state. **Status:** PASS. **Required action:** None.
- **Invariant:** No historical Item Effect type remains executable in the current runtime. **Evidence:** historical `magnet`/`swapPosition`/`ghostMode`/`aimVariance` forms are handled only by migration or compatibility helpers; current runtime construction lowers current content to generic command/filter/action templates. **Status:** PASS. **Required action:** None.
- **Invariant:** No compatibility representation is accepted outside migration boundaries. **Evidence:** `GameHandlerBuilder.fromSettings()` calls `migrateGameSettingsEffects()` before strict runtime construction; current validators require schema version 1. **Status:** PASS. **Required action:** None.
- **Invariant:** No transient activation event is persisted as authoritative state. **Evidence:** `schedule.due` is emitted transiently by `advanceDeferredEffectsTick()`; only deferred records, not activation events, are serialized. **Status:** PASS. **Required action:** None.
- **Invariant:** No lifecycle state is duplicated between Item state and Handler/world state. **Evidence:** TemporalModifier and DeferredEffect state have separate owners; Structure participation is canonical Structure state while StructureLifecycle stores only timing metadata. **Status:** PASS. **Required action:** None.
- **Invariant:** Collision filter state and lifetime state have one entity-owned canonical owner each. **Evidence:** `PlayerSettings.collisionFilters` stores relation exclusions and `collisionFilterLifetimes` stores turn expiry; `itemEffects` stores neither for current Ghost Mode. **Status:** PASS. **Required action:** None.
- **Invariant:** No generic Engine primitive contains KORE Item names or terminology. **Evidence:** Engine contracts and SDK capabilities use generic movement, transform, participation, lifecycle, and deferred terminology; Wunderkiste terminology remains in `src/item` and `Handler` orchestration. **Status:** PASS. **Required action:** None.
- **Invariant:** No retained KORE semantic was moved into Engine solely to remove a Handler branch. **Evidence:** Wunderkiste reward-pool interpretation remains in `officialItems.ts`/`Handler`; no generic reward subsystem was introduced. **Status:** PASS. **Required action:** None.

### State And Lifecycle Ownership

- **Invariant:** TemporalModifier remaining exists in exactly one persisted owner. **Evidence:** `Player.temporalModifiers` owns and serializes it; `itemEffects` stores no temporal remaining state. **Status:** PASS. **Required action:** None.
- **Invariant:** StructureLifecycle remaining is not duplicated in Structure runtime state. **Evidence:** `StructureLifecycleSettings.remaining` is Handler-owned; the canonical Structure stores only geometry and participation flags. **Status:** PASS. **Required action:** None.
- **Invariant:** DeferredEffect remaining/order is not duplicated in Item effects or `schedule.due`. **Evidence:** Handler-owned `deferredEffects` is serialized; `schedule.due` is an ephemeral trigger event and the Item effect is removed from the active deferred record. **Status:** PASS. **Required action:** None.
- **Invariant:** Entity velocity has no Item-owned copy. **Evidence:** movement commands read/write the entity runtime velocity through `MovementSystem`; Item state stores command/configuration only. **Status:** PASS. **Required action:** None.
- **Invariant:** Structure participation remains canonical Structure state. **Evidence:** `FullStructure.toSettings()` serializes `physicsEnabled` and `drawingEnabled`; lifecycle expiry now changes them through `ParticipationSystem`. **Status:** PASS. **Required action:** None.
- **Invariant:** Wunderkiste reward state does not require hidden RNG/runtime state. **Evidence:** `deriveMysteryBoxSeed()` uses actor, turn, team, and configured/game seed; reward resolution validates the whole pool before inventory mutation. **Status:** PASS. **Required action:** None.
- **Invariant:** TemporalModifier, StructureLifecycle, and DeferredEffect remain semantically distinct. **Evidence:** their contracts enforce respectively turn-scoped behavior, timed canonical Structure participation, and one-shot tick execution. **Status:** PASS. **Required action:** None.

### Dispatcher And Movement

- **Invariant:** Generic mechanical execution follows Handler/content -> canonical command -> `dispatchPredefinedEffect()` -> owning System -> runtime object API. **Evidence:** `MovementSystem`, `TransformSystem`, and `ParticipationSystem` are the sole interpreters for the audited commands; lifecycle expiry uses the same dispatcher. **Status:** PASS. **Required action:** None.
- **Invariant:** Handler has no direct Magnet velocity mutation, Switch position mutation, Falltür participation mutation, force-field math, or NumericSystem bypass. **Evidence:** direct Handler `setVel`, `setPos`, and participation calls are absent; `setStructureParticipation()` constructs and dispatches generic participation commands. **Status:** PASS. **Required action:** None.
- **Invariant:** Movement command semantics remain separate. **Evidence:** `MovementSystem` has distinct branches for set velocity, add velocity, scale speed, area force field, and selected-entity force; radial math exists in `movementForceField.ts`. **Status:** PASS. **Required action:** None.
- **Invariant:** Freeze-Shot applies once per accepted movement action, not every tick. **Evidence:** `applyTemporalModifiers()` is called during accepted/raw/playback turn application; `MovementSystem.preTick()` does not inspect temporal modifiers. **Status:** PASS. **Required action:** None.
- **Invariant:** Area force fields remain area-wide and selected-entity force remains selected-only. **Evidence:** area force iterates eligible entities; entity force resolves exactly one target; Magnet characterization covers unrelated in-range entities. **Status:** PASS. **Required action:** None.

### Transform, Participation, And Item Invariants

- **Invariant:** Switch captures both positions before either write and swaps only positions. **Evidence:** `TransformSystem` reads `firstPosition` and `secondPosition` before both `setPos()` calls; the characterization test covers atomicity and unchanged non-position state. **Status:** PASS. **Required action:** None.
- **Invariant:** Falltür/Mini-Wall position and participation remain orthogonal. **Evidence:** `TransformSystem` only sets position; `ParticipationSystem` only sets physics/drawing flags. **Status:** PASS. **Required action:** None.
- **Invariant:** Physics and drawing participation remain orthogonal to death and Ghost Mode. **Evidence:** Ghost Mode only changes `PhysicsSystem` pair eligibility; participation flags remain independently serialized and BoundarySystem still eliminates out-of-bounds players. **Status:** PASS. **Required action:** None.
- **Invariant:** Mini-Wall instances have stable independent identity and expire by disabling participation. **Evidence:** Handler creates IDs from actor, item, and turn; lifecycle expiry retains the canonical Structure and disables both flags; characterization covers multiple owners and restore. **Status:** PASS. **Required action:** None.
- **Invariant:** Delayed Mine binds position at use, resolves entities at due time, uses ticks, removes before execution, and executes once. **Evidence:** `createDeferredEffect()` stores the resolved position; `advanceDeferredEffectsTick()` removes due records before dispatch; Handler tick order runs this before entity/system processing; characterization covers timing and one-shot behavior. **Status:** PASS. **Required action:** None.
- **Invariant:** Magnet affects only the selected entity and keeps actor origin distinct. **Evidence:** Handler dispatches an entity target with `origin: actor.getPos()`; `MovementSystem` applies the radial delta only to that target. **Status:** PASS. **Required action:** None.

### Wunderkiste And Migration Boundaries

- **Invariant:** Candidate order and deterministic seed-derived selection remain stable. **Evidence:** `resolveMysteryBoxReward()` indexes the declared pool using the supplied seed; tests cover explicit order and repeated seeded results. **Status:** PASS. **Required action:** None.
- **Invariant:** Entire reward configuration validates before mutation and exactly one capped grant occurs. **Evidence:** Handler resolves before `consumeInventoryItem()`; `grantMysteryBoxReward()` delegates to `addDrawnInventoryItem()`; gameplay tests cover invalid pools, recursion, and caps. **Status:** PASS. **Required action:** None.
- **Invariant:** MapPickupSystem remains a separate semantic consumer. **Evidence:** it grants configured map pickups through shared inventory helpers and does not resolve Wunderkiste rewards. **Status:** PASS. **Required action:** None.
- **Invariant:** Historical forms remain migration-only. **Evidence:** `EffectType.Damage` appears only in `src/migrations/effects.ts`; historical Magnet/Switch names appear in migration tests/boundaries; no `EffectMagnet`, `EffectSwapPosition`, `EffectDelayed`, or `EffectTemporaryWall` runtime implementation remains. Current `EffectModifySetting` is a validated generic core effect, not a historical Item compatibility path. **Status:** PASS. **Required action:** None.

The audit initially found and corrected two violations: direct Handler participation writes for generic StructureLifecycle expiry/removal, and unseeded `Math.random()` fallbacks in official Item helpers. Focused regression tests and TypeScript validation pass after the corrections.

## Power-Dash Qualification Decision

Power-Dash is the next semantic-convergence slice. This decision is recorded before changing the production action path.

- **Power-Dash pre-slice production behavior:** Item validation, inventory consumption, rule-phase advancement, and replay recording worked. The historical `modifyForce` runtime object was stored in `Player.itemEffects`, but no accepted shot path read it, so the live Item was a no-op. `tests/power_dash_characterization.test.ts` captures that defect boundary.
- **Intended semantic:** The next accepted relevant shot uses the declared force multiplier exactly once. The official configuration supplies factor `1.5`; the GDD's older "friction reduce" wording is superseded for this slice by the current declarative Item contract and generic force-scale formula.
- **Current runtime owner:** `GameHandler.useItem()` installs Item runtime state on the target Player; `GameHandler.resolveTurn()` owns accepted-shot simulation and `defaultPhysics.applyImpulse()` owns force-to-velocity conversion.
- **Historical force behavior:** The former `EffectModifyForce` normalized angle and returned `{ angle, power: power * factor }`; the current generic action modifier preserves that formula and validation without a runtime Item Effect object.
- **Accepted action pipeline:** validated emitter/server/AI input -> replay records raw accepted action -> `simulateTurn()` or authoritative `resolveTurn()` -> `applyImpulse()` -> fixed physics ticks -> final-state packet. Power-Dash must bind between accepted input validation/recording and `applyImpulse()`.
- **Exact force formula:** `effectivePower = acceptedPower * 1.5`; direction/angle is unchanged and no post-modifier maximum-power clamp is applied.
- **Action binding point:** Transform the accepted `{ angle, power }` value immediately before `PhysicsStrategy.applyImpulse()` in the shared Handler action boundary. Do not scale retained velocity after impulse.
- **Consumption semantics:** Consume one pending modifier only after the action is accepted and its effective force has been calculated. Emitter/server validation rejects invalid input before consumption; rejected actions do not consume it.
- **Turn/lifetime semantics:** Power-Dash persists until the next accepted shot; it is not turn-expiring. The current Item phase permits one use per turn and the Item interaction policy is deterministic stacking, so multiple pending modifiers may compose only when a mode permits multiple accepted uses.
- **Rejected-action semantics:** Invalid/rejected input does not reach the accepted action boundary and leaves the pending modifier unchanged.
- **Snapshot behavior:** Pending force modifiers belong in detached Player snapshot state and must restore identically before the next shot.
- **Replay behavior:** Replay continues to record the raw Item and shot actions. Replay reconstruction restores the pending modifier from the Item action and reapplies it through the same accepted shot path; effective force is not duplicated in replay data.
- **AI behavior:** AI submits through the same emitter/action boundary; no Power-Dash-specific AI path is justified.
- **Why `movement.scale-speed` is not equivalent:** It scales existing velocity after impulse, while force scaling changes the impulse by `factor / mass` before friction, collision, and fixed-frame integration. The two operations diverge for non-zero retained velocity, mass other than one, and subsequent physics.
- **TemporalModifier reusable?:** No. TemporalModifier is turn-counted behavior applied across accepted movement actions; Power-Dash is one-shot action consumption with no turn countdown.
- **Missing generic primitive:** A narrow accepted-action force modifier contract with stable JSON state, deterministic ordering, and one-shot consumption.
- **Expected Anker reuse:** Anker may later reuse the accepted-force operation with a different lifetime policy; Anker is not implemented in this slice.
- **Chosen canonical representation:** Entity-owned `pendingActionModifiers` containing generic force-scale operations and explicit remaining-use state; no Item name or runtime object reference.
- **Runtime owner:** The shared accepted action boundary in `GameHandler`, with generic contract validation and the existing physics impulse owner. No Power-Dash System or Power-Dash Handler branch.
- **Migration justified?:** Yes. Power-Dash and Anker now lower `modifyForce` to the generic action-modifier contract; historical `itemEffects.modifyForce` state is normalized at the explicit migration boundary and the legacy runtime class is removed.

Power-Dash implementation outcome:

- `src/engine/contracts/actionModifier.ts` provides the narrow generic JSON-safe accepted-force modifier contract with deterministic ordering and one-shot consumption.
- `PlayerSettings.pendingActionModifiers` is the sole canonical pending-action owner; `Player.itemEffects` no longer stores newly accepted `modifyForce` state.
- `GameHandler` applies pending force modifiers immediately before `PhysicsStrategy.applyImpulse()` in resolve, playback, and raw accepted-action paths, then consumes them once.
- The explicit migration boundary moves historical `modifyForce` entries from `itemEffects` into `pendingActionModifiers`.
- Human, AI, local replay, network snapshot, and restore paths use the same accepted-action boundary; replay records raw Item and shot intent rather than effective force.
- No Power-Dash-specific Engine System or mechanical Handler branch exists. The Handler lowers the generic action-modifier template and derives optional lifetime metadata from the declarative duration.
- Power-Dash characterization, generic action-modifier, migration, SDK, phase, replay, snapshot, and AI tests pass.

### Power-Dash Negative Invariants

- **Invariant:** No Power-Dash-specific Engine System or Handler mechanical branch exists. **Evidence:** action modifiers are generic contracts and the Handler lowers generic action-modifier templates. **Status:** PASS. **Required action:** None.
- **Invariant:** Power-Dash does not mutate velocity directly or apply both force and velocity modifiers. **Evidence:** it transforms the accepted input before `applyImpulse()`; `MovementSystem` is not involved. **Status:** PASS. **Required action:** None.
- **Invariant:** A rejected action does not consume the one-shot modifier. **Evidence:** emitter/server validation occurs before the Handler action boundary; characterization covers rejected power. **Status:** PASS. **Required action:** None.
- **Invariant:** Human, AI, and replay actions share the same modifier boundary. **Evidence:** all use `GameHandler` accepted-action methods; characterization covers AI and replay parity. **Status:** PASS. **Required action:** None.
- **Invariant:** Pending action state is canonical and JSON-safe. **Evidence:** `PlayerSettings.pendingActionModifiers` validates and round-trips; snapshot and replay characterization restores the same effective result. **Status:** PASS. **Required action:** None.
- **Invariant:** No hidden randomness, wall-clock state, duplicate modifier owner, or over-broad action framework was introduced. **Evidence:** the contract contains only force scale, explicit remaining uses, stable ordering, and JSON data; no scheduler, event bus, or universal expression layer was added. **Status:** PASS. **Required action:** None.

## Anker Qualification

Anker characterization and semantic qualification were completed from the current declarative contract and accepted-action implementation.

- **Anker current production behavior:** Before this slice, Anker was accepted, consumed inventory, advanced the Item phase, recorded replay intent, and lowered to a one-shot pending force modifier. It applied factor `0.5` to the next accepted shot, but ignored its declared two-turn duration.
- **Declarative contract:** Self-targeted `modifyForce` with factor `0.5`, `duration: turns(2)`, `perTurn: 1`, and `perGame: 2`. The duration is the time policy; inventory limits remain consumption/availability policy.
- **Force operation:** `effectivePower = acceptedPower * 0.5`; angle is unchanged; raw input is validated before the action boundary; no post-modifier clamp is introduced.
- **Lifetime policy:** Active for two qualified turn intervals. The first accepted shot uses `remaining: 2`; the normal turn transition advances it to `1`; the next eligible shot uses it; the following qualified turn transition expires it. A turn advancement without a shot still advances the lifetime exactly once at the existing Handler boundary.
- **Consumption policy:** Anker has no `remainingUses` action-consumption field. It applies to every eligible accepted shot while its lifetime remains active. Inventory `perTurn`/`perGame` limits remain separate.
- **Rejected-action semantics:** Existing emitter/server validation rejects invalid shots before the accepted-action boundary; Anker lifetime and action state are unchanged.
- **Stacking semantics:** The existing default Item interaction mode remains stacking. Multiple action modifiers use stable `sourceOrder` and ID ordering. Anker and Power-Dash therefore compose deterministically to `0.5 * 1.5 = 0.75` when a mode permits both uses.
- **Snapshot/replay behavior:** The pending modifier stores flat lifetime fields in `PlayerSettings`; restore preserves the exact remaining value. Replay records raw Item and shot intent and reapplies the same lifetime/action boundary.
- **AI/network behavior:** AI uses the same accepted-action emitter path. Network `ITEM_USED` snapshots carry the pending modifier through ordinary Player settings reconciliation; no Anker transport or AI branch exists.
- **Power-Dash reuse:** Yes. Both use the generic force-scale action operation; Power-Dash uses `remainingUses: 1` without time lifetime.
- **Lifetime-core reuse:** Yes. The pending action owner uses the shared pure lifetime arithmetic for its optional turn fields; it retains the advancement boundary and expiry removal.
- **TemporalModifier reuse:** No. Anker is an action-bound command with optional lifetime metadata, not a persistent movement Engine effect targeted through the TemporalModifier contract.
- **Missing generic primitive:** None. The existing pending action modifier now supports either explicit action-use consumption or optional flat lifetime metadata, justified by Power-Dash and Anker together.
- **Canonical owner:** `PlayerSettings.pendingActionModifiers` and the Player runtime object.
- **Runtime interpreter:** The shared Handler accepted-force boundary applies the modifier before `PhysicsStrategy.applyImpulse()`; Player advances optional turn lifetime at the existing `setTurnNumber()` boundary.
- **Migration boundary:** Historical `itemEffects.modifyForce` entries are converted to pending action modifiers; Anker entries derive their two-turn lifetime from the declared Item document.
- **Legacy runtime status:** `src/effects/modifyForce.ts` and its executable runtime-object path were removed. Declarative `modifyForce` remains a validated Item authoring identifier and is lowered through the generic action-modifier template. Remaining source references are authoring, validation, migration, or tests.

### Anker Negative Invariants

- **Invariant:** No Anker-specific Engine System or mechanical Handler branch exists. **Evidence:** Anker lowers through the generic `isActionModifierTemplate()` path; lifetime advancement is generic Player state behavior. **Status:** PASS. **Required action:** None.
- **Invariant:** No direct velocity mutation or post-impulse movement scaling implements Anker. **Evidence:** Anker modifies accepted force before `PhysicsStrategy.applyImpulse()`; `MovementSystem` is not involved. **Status:** PASS. **Required action:** None.
- **Invariant:** Lifetime and action-use consumption remain distinct. **Evidence:** Anker has `durationUnit/duration/remaining` and no `remainingUses`; Power-Dash has `remainingUses` and no lifetime. **Status:** PASS. **Required action:** None.
- **Invariant:** No duplicate `itemEffects` and `pendingActionModifiers` Anker ownership exists. **Evidence:** new uses install only pending action state; migration removes historical `modifyForce` item effects. **Status:** PASS. **Required action:** None.
- **Invariant:** Rejected actions do not consume or advance Anker state. **Evidence:** action validation precedes the shared accepted-action boundary; lifetime advances only from Handler turn transitions. **Status:** PASS. **Required action:** None.
- **Invariant:** No lifetime countdown is encoded in trigger data or hidden runtime state. **Evidence:** lifetime fields are canonical Player settings and no trigger/scheduler path is involved. **Status:** PASS. **Required action:** None.
- **Invariant:** No wall-clock, randomness, universal middleware, or Item-specific generic contract was introduced. **Evidence:** only existing action/lifetime contracts were extended; the shared Engine contracts contain no Item names. **Status:** PASS. **Required action:** None.
- **Invariant:** No current executable `EffectModifyForce` runtime path remains. **Evidence:** the class/module is removed; source search finds only declarative `modifyForce`, validation, migration, authoring, and tests. **Status:** PASS. **Required action:** None.

## Final Selection Lock Qualification Pass

This fresh read-only characterization was performed from the clean Vodka-Zero checkpoint after refreshing repository evidence.

### Ghost Mode / Durchlässigkeit

- **Pre-slice production behavior:** Item use was accepted, inventory/rule/replay state advanced, and executable `ghostMode` state was stored in `Player.itemEffects`; `PhysicsSystem` ignored that state, so player and structure contacts still resolved normally.
- **Declarative contract:** Self-targeted `ghostMode` with `durationTurns: 2`; the Item description says it ignores entity and Structure collisions for a short duration.
- **Interaction matrix:** Player-player and player-structure contacts are filtered before detection/resolution and produce no impulse, depenetration, or entry callback. Boundary containment remains `BoundarySystem` logic, so leaving the arena still eliminates the player. Collision-based structure hazards are filtered as structure contacts; no general non-collision hazard immunity is added. Movement, friction, drift, and drawing remain unchanged.
- **Why participation is not equivalent:** `physicsEnabled: false` removes the player from movement integration and the PhysicsSystem, and `drawingEnabled: false` is coupled by elimination. Ghost Mode keeps both enabled and only excludes selected collision relations.
- **Chosen primitive:** Generic entity-owned `collisionFilters` with `excludedCategories: ["entity", "structure"]`, plus separate `collisionFilterLifetimes` using the shared turn lifetime core. `PhysicsSystem` checks the pure `isCollisionAllowed()` contract before collision detection and excludes filtered pairs from overlap accounting, resolution, and contact tracking.
- **Canonical owner:** `PlayerSettings.collisionFilters` and `PlayerSettings.collisionFilterLifetimes`; no PhysicsSystem-local authoritative state.
- **Legacy migration:** Historical `itemEffects.ghostMode` records migrate explicitly to the filter/lifetime pair. Current KORE runtime lowering returns the generic filter template; `EffectGhostMode` remains historical/helper compatibility only.
- **Replay/snapshot/AI/network:** The canonical Player state is copied through snapshots, replay origin restoration, AI simulation, and server-authoritative resolution. No transport-specific collision path exists.
- **Qualification:** E. No Ghost Mode-specific System, Handler branch, hazard rule, physics participation toggle, universal collision DSL, or Item-name Engine contract was introduced.

### Selection Lock / Jägermeister-Elixier

- **Pre-slice production behavior:** Enemy target validation, inventory/rule/replay recording, and serialized `selectionLock` Item state worked. UI, local input, server validation, AI, and replay accepted the locked entity as an actor.
- **Declarative contract:** Enemy-entity target within range; `selectionLock` duration is two turns; description says the opponent figure cannot be selected during that duration.
- **Exact semantic:** The targeted enemy entity is excluded from acting while the constraint is active. It may remain a valid target for other Items; no target eligibility restriction is introduced.
- **Authority:** `GameHandler.validateActorForAction()` is the shared authoritative actor boundary. Local emitter, server registry, AI emitter/candidate generation, replay, and UI projection consult the same canonical entity eligibility.
- **Lifetime and invalid entity behavior:** The global completed-turn lifetime is two turns, using the shared lifetime core. Dead entities are already ineligible; the constraint expires normally at its turn boundary and does not create fallback or turn deadlock behavior.
- **Canonical representation:** `PlayerSettings.actorEligibilityConstraints` stores the entity-owned exclusion; `actorEligibilityConstraintLifetimes` stores separate turn countdown state. Stable Player identity remains the owner; no actor ID, array index, DOM state, or runtime reference is persisted in the constraint.
- **Legacy migration:** Historical `itemEffects.selectionLock` records migrate explicitly to the constraint/lifetime pair. Current runtime lowering returns the generic actor-eligibility template; `EffectSelectionLock` remains historical/helper compatibility only.
- **Qualification:** E. Actor legality is authoritative and target validation remains independent; no UI-only bypass, Item-specific Engine system, or universal policy framework was introduced.

### Vodka-Zero

- **Pre-slice production behavior:** Item use consumed inventory and stored executable `aimVariance` state in `Player.itemEffects`; the accepted-shot path ignored it, so live movement was unaffected.
- **Declarative contract:** Self-targeted `aimVariance` with maximum variance of 10 degrees and instant Item duration; the Item adds seeded deterministic aim variance to shots.
- **Exact formula:** `effectiveAngle = normalizeAngle(rawAngle + ((nextRandom() * 2) - 1) * maxVarianceDegrees)`; `power` is unchanged. `SeededRandom.next()` returns `[0, 1)`, and normalization is `((angle % 360) + 360) % 360`.
- **Random model:** Model B. The canonical modifier stores the current unsigned 32-bit `randomState`; accepted application derives one offset from it, and accepted consumption advances it once. The official declarative Item has no seed, so its existing runtime default `1337` is preserved. The helper’s explicit seed is converted to the same canonical state.
- **Rejected-action behavior:** Validation occurs before the accepted-action boundary, so rejected shots do not apply, consume, or advance the modifier state and are not recorded in replay.
- **Lifetime and consumption:** One accepted shot via `remainingUses: 1`; no `duration` or `durationUnit`. Action-use consumption remains separate from turn lifetime.
- **Ordering:** Modifiers sort by explicit `sourceOrder`, then stable `id`. Aim modifiers transform angle and force modifiers transform power within that deterministic sequence. No runtime insertion order is authoritative.
- **Canonical representation:** `PlayerSettings.pendingActionModifiers` stores `{ schemaVersion, id, action: "aim", operation: "random-offset", maxVarianceDegrees, randomState, remainingUses, sourceId, sourceOrder }`.
- **Runtime boundary:** `GameHandler.applyAcceptedForce()` applies generic pending modifiers immediately before `PhysicsStrategy.applyImpulse()` and consumes them only after application.
- **Replay/snapshot/AI/network:** Replay records raw `{ angle, power }`; replay restoration, snapshot restoration, AI emitters, local input, and server `resolveTurn()` all use the same accepted-action boundary. Effective angle is never trusted from the client or duplicated in replay.
- **Legacy migration:** Historical `itemEffects` `aimVariance` records migrate explicitly to `pendingActionModifiers`. `EffectAimVariance` remains only as a historical/helper compatibility decoder; it is no longer constructed by the current KORE runtime factory or installed as current live state.
- **Qualification:** E. The smallest justified aim-domain operation was added without a Vodka-Zero-specific System, Handler branch, RNG framework, expression language, or tick lifetime.

### Selection Lock Qualification Decision

- **Variant A, UI-only:** Rejected. Direct local/server/AI/replay actor input would bypass it.
- **Variant B, generic actor eligibility constraint:** Chosen. One entity-owned exclusion semantic matches the real consumer.
- **Variant C, target eligibility constraint:** Rejected. The Item locks the targeted entity as an actor, not as a target.
- **Variant D, canonical selection-policy union:** Rejected as broader than required; no forced/allowed target or actor modes are evidenced.
- **Variant E, existing target validation:** Partial reuse only. Existing active/team/stable-ID checks remain; policy eligibility is a distinct constraint evaluated after those checks.
- **UI behavior:** UI rejects locked actors as a projection of canonical state; it does not own the rule.
- **Negative invariants:** No Selection Lock-specific Engine System or mechanical Handler branch; no UI-only bypass; no AI/replay/client trust; no duplicate UI and canonical owner; no runtime references or array indexes; no wall-clock/randomness; no triggerValue policy; no lifetime/consumption conflation; no universal policy engine.
- **Verification:** `tests/selection_lock_qualification.test.ts`, `tests/actor_eligibility_qualification.test.ts`, `tests/effect_migration.test.ts`, `tests/item_authorization.test.ts`, `tests/item_emitter.test.ts`, and existing target/effect tests cover acceptance, forbidden actor, target independence, UI, server, AI, replay, snapshot, expiry, and migration.

The production migration is complete; all official Items are now qualified or explicitly retained KORE semantics.

## Final Engine Language Inventory

| Domain | Canonical representation | Owner/interpreter | Qualified consumers |
|--------|--------------------------|-------------------|---------------------|
| Movement | JSON-safe movement commands/effects | `MovementSystem` | Freeze-Shot, Magnet, Delayed Mine |
| Transform | Stable entity/structure transform commands | `TransformSystem` | Switch, Falltür |
| Participation | `participation.set-physics` / `set-drawing` | `ParticipationSystem` | Elimination, StructureLifecycle |
| Numeric | Entity-owned numeric state and thresholds | `NumericSystem` | Damage, elimination, shields |
| Action Modifier | `pendingActionModifiers` | `GameHandler` accepted-action boundary | Power-Dash, Anker, Vodka-Zero |
| Lifetime | Flat `durationUnit` / `duration` / `remaining` | Feature owner plus pure lifetime core | Temporal, structure, deferred, collision, eligibility lifetimes |
| Deferred Effect | Stable deferred records | `GameHandler` scheduler | Delayed Mine |
| Structure Lifecycle | Stable canonical structure plus lifecycle record | `GameHandler` | Mini-Wall |
| Collision Filter | Entity-owned relation exclusions | `PhysicsSystem` pair boundary | Ghost Mode |
| Actor Eligibility | Entity-owned actor exclusion constraints | `GameHandler.validateActorForAction()` and shared projections | Selection Lock |
| Trigger | JSON-safe activation events | Trigger dispatcher / owning host | Falltür, deferred effects, replay events |
| Dispatcher | Predefined stable Engine command routing | System interpreters | All generic command lowerings |

No unqualified official Item remains. Wunderkiste remains intentionally KORE-owned reward semantics rather than a generic Engine reward language.

## Checkpoint Workflow

After every completed Item Convergence migration:

1. Refresh repository evidence and CocoIndex.
2. Rerank all remaining official Items from the current source and tests.
3. Update this document with the baseline commit.
4. Select the next Item only from the refreshed ranking.
