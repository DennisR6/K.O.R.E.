# Item Convergence

Last reranked after commit: `3e30215 refactor(items): converge magnet on entity force movement`

Repository state: clean / qualified for the completed Delayed Mine slice.

CocoIndex state: refreshed after the baseline commit; current index contains 720 files and 7,106 chunks.

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

## Current Ranking

Already-converged Items are excluded from this active ranking.

| Rank | Item | Classification | Existing primitives reused | Missing semantic | Legacy removal value | Risk | Recommendation |
|------|------|----------------|----------------------------|------------------|----------------------|------|----------------|
| 1 | Switch | B | Stable entity targets, `transform.set-position`, ordered `effect.composition` | Atomic read-before-write multi-entity transform | Medium-high: removes `EffectSwapPosition` and the Handler branch | Medium | Current next-order candidate; not implemented in this checkpoint |
| 2 | Wunderkiste | D | Item economy, seeded draws, stable actor identity, scheduling concepts | Reward-pool and inventory-grant semantics remain KORE content meaning | Low | Low if retained; risky to generalize | Retain as KORE-specific |
| 3 | Anker | F | `EffectModifyForce`; `movement.scale-speed` is only an approximation | Accepted-action force modifier | Low currently; no live production consumer | High | Defer |
| 4 | Power-Dash | F | Same potential primitives as Anker | Accepted-action force modifier | Low currently; no live production application | High | Defer with Anker |
| 5 | Ghost Mode / Durchlässigkeit | F | Temporal lifetime shape only | Collision category/filter semantics; participation flags are not equivalent | Potentially high, but the semantic gap is large | High | Defer |
| 6 | Selection Lock / Jägermeister-Elixier | F | Turn-counted state shape | Selection/input-policy capability; no current `UiSystem` consumer | Low | Medium | Retain until input policy evolves |
| 7 | Vodka-Zero | F | Deterministic random state only | Accepted-shot aim modifier | Low currently; no live production consumer | High | Retain as shot-policy semantic |

## Remaining Item Inventory

The seven remaining Items below, together with the five completed Items above, are the complete official catalog from `createOfficialItemLoader()`.

| Item | Production consumer | Current runtime path | Target / phase | Lifecycle/state | Reusable primitives | Gap / classification |
|------|---------------------|----------------------|----------------|-----------------|---------------------|---------------------|
| Anker | No live force application; helper and runtime factory only | Declarative `modifyForce` -> `EffectModifyForce`; `applyAnkerForce()` is a helper | Self / Item phase; intended next accepted shot | Factor `0.5`; declared two turns, but the runtime effect has no countdown | Possible `TemporalModifier` plus movement command, but not exact input semantics | Missing accepted-action force modifier; F |
| Power-Dash | Declared in the canonical playable match, but no live force application | Declarative `modifyForce` -> `EffectModifyForce`; `applyPowerDashForce()` is a helper | Self / Item phase; intended next accepted shot | Factor `1.5`; instant declaration | Same as Anker; `movement.scale-speed` would be only a post-impulse approximation | Missing accepted-action force modifier; F |
| Durchlässigkeit | No `PhysicsSystem` collision-filter consumer | Declarative `ghostMode` -> `EffectGhostMode`; flag is stored and serialized | Self / Item phase | Two-turn `shouldIgnoreCollision()` state | Temporal lifetime shape only | Requires collision filter/category semantics; participation is not equivalent; F |
| Switch | `GameHandler.applyItemEffects()` captures both positions and writes both entities | Declarative `swapPosition` -> `EffectSwapPosition` plus direct Handler mutation | Ally entity / Item phase | Instant atomic position exchange | Stable entity targets, transform commands, ordered composition | Requires generic read-before-write atomic multi-target transform; B |
| Jägermeister-Elixier | No `UiSystem` selection-lock check | Declarative `selectionLock` -> `EffectSelectionLock`; state is stored and serialized | Enemy entity / Item phase | Two-turn lock flag | Turn lifetime only | Requires KORE input-selection policy; F |
| Vodka-Zero | No production shot/input consumer | Declarative `aimVariance` -> `EffectAimVariance`; seeded state is serializable | Self / Item phase | Instant declaration; random state advances on `applyToForce()` | Deterministic random state | Requires accepted-shot aim modifier; F |
| Wunderkiste | `GameHandler.resolveMysteryBoxUse()` plus reward resolver and inventory economy | Declarative `spawnTrigger` declaration with a special Handler reward branch | Self / Item phase | Deterministic reward ID, recursion guard, per-game inventory cap | Item economy, seeded draw state, stable actor identity, scheduling concepts | Reward selection/grant remains KORE content semantics; D |

## Evidence Notes

- The official catalog is authored in `src/item/officialItems.ts` and loaded by `createOfficialItemLoader()`.
- The production Item boundary is `GameHandler.useItem()` and `applyItemEffects()` in `src/engine/Handler.ts`.
- `movement.apply-force-field` remains the area-wide Delayed Mine command; `movement.apply-force-to-entity` is the explicit selected-entity command used by Magnet.
- `transform.set-position` is defined in `src/engine/sdk/transformCapability.ts`; `effect.composition` is ordered but does not provide read-before-write binding.
- `participation.*` controls physics/drawing participation and must not be treated as Ghost Mode collision filtering.
- The gameplay qualification suite intentionally keeps `effect-disappears-after-use` visible for incomplete Item paths rather than promoting them to qualified behavior.

## Recommended Next Item

Recommended next-order Item: **Switch**

Reason: Magnet is complete. The refreshed repository-backed ranking now places Switch first because its existing atomic swap behavior is bounded by one generic read-before-write transform semantic. Switch is ranked only; it was not implemented in this checkpoint.

Expected lowering for the next ranked candidate:

```text
KORE target validation
-> stable entity targets
-> atomic read-before-write transform command
-> shared predefined dispatcher
```

Expected missing primitive: an atomic multi-target transform with current-position capture before either write. Naïve sequential `transform.set-position` composition is insufficient.

Required characterization:

- Both source positions are captured before mutation.
- The two active entities exchange positions exactly once.
- Inactive and self targets are rejected.
- Stable entity IDs survive snapshot and replay.
- Intermediate-state validity is not exposed to collision or validation code.

## Final Drift Audit

Already-converged Items must not be opportunistically rewritten during active convergence. Falltür is especially deferred and must remain unchanged while Magnet or another selected Item is migrated.

After all intended Item slices are complete, perform one final drift audit against the completed Engine/KORE primitive set. The audit must verify that each completed lowering still uses the current generic contracts and that no Item-specific runtime branch has reappeared.

## Checkpoint Workflow

After every completed Item Convergence migration:

1. Refresh repository evidence and CocoIndex.
2. Rerank all remaining official Items from the current source and tests.
3. Update this document with the baseline commit.
4. Select the next Item only from the refreshed ranking.
