# Engine Extraction Root-Cause Reassessment

Date: 2026-03-30
Source branch: `engine-extraction`

This reassessment does not treat every import as an architectural blocker. It distinguishes local import statements from semantic coupling sites and separates the existing generic SDK from the KORE match runtime that currently lives under `src/engine`.

## Counting method

The reviewed boundary consists of:

- `src/engine/Handler.ts`, `src/engine/types.ts`, `src/engine/runtimeFactory.ts`
- `src/systems/systemSettings.ts`
- `src/entity/Entity.ts`, `EntityManager.ts`, `runtimeFactory.ts`
- `src/physics/physics.ts`, `defaultPhysics.ts`
- `src/effects/effects.ts`, `runtimeFactory.ts`
- `src/replay/player.ts`, `replay/types.ts`

There are **164 local import edges** in those files (106 runtime imports and 58 type-only imports, counting import statements). Most are internal generic/framework edges and are not Engine -> Game coupling.

After semantic classification, there are **47 game-facing coupling sites**. A coupling site means a concrete game concept, reconstruction decision, or game-owned policy crossing the proposed engine boundary; repeated imports caused by the same mechanism are counted once per semantic use site, not once per file import.

## Step 1: traced dependencies

### `src/engine/Handler.ts`

| Engine location/use | Imported game symbol | Semantic reason | Concrete type required? | Replacement/classification |
|---|---|---|---|---|
| constructor and serialized entity management | `EntityManager`, `createRuntimePlayer`, `IEntity` | owns the live entity collection and reconstructs player snapshots | Yes in current implementation; no for a generic host | Inject `EntityStore`/`RuntimeFactory`; **A/B, reconstruction** |
| turn simulation and playback | `GameHandlerBuilder`, `PlaybackSystem`, `PhysicsSystem` | clones settings, resolves a turn, and locates concrete systems with `instanceof` | Current orchestration requires concrete implementations | Generic `SimulationHost`, system capabilities/IDs; **B** |
| default startup and restore | `createSystemFromSettings`, `GameStateManager`, `MovementSystem`, `BoundarySystem`, `EnvironmentalSystem`, `TransformSystem`, `ParticipationSystem`, `NumericSystem` | installs/restores a particular KORE framework profile | No for a generic engine; yes for current KORE profile | Move profile registration outward; **B/C, system registration** |
| settings/defaults | `GameSettings`, `DEFAULT_DRIFT`, `FrictionSettings`, validators | KORE map/settings schema and defaults | Data contract, not game behavior in the algorithm | Generic world/physics settings plus KORE adapter; **A** |
| structures | `FullStructure`, `IStructure`, map boundary settings | turns serialized map geometry into runtime collision/drawing objects | Factory needed, concrete KORE structure not intrinsic to solver | Inject structure factory; **A/B** |
| effects and triggers | `Effect`, `createRuntimeEffect`, migrations, trigger dispatcher | executes serialized effects and normalizes historical KORE snapshots | Generic execution host is reusable; catalog is replaceable | `EffectRegistry`/dispatcher already exists in SDK direction; **B/C** |
| rules and turn phases | `RuleInterpreter`, `RulePhase`, `MatchStatus`, `RuleState`, `currentTurnMode` | phase transitions, active-team progression, match result | Definitely game rules | Move to KORE handler/emitter; **C** |
| item economy | item inventory, pickups, target resolution, interactions, official-item runtime | item use authorization, item lifecycle, mystery-box behavior | Definitely KORE behavior | KORE application layer; **C** |
| AI | `EasyAi`, `MediumAi`, `HardAi`, AI settings | creates KORE AI producers and removes AI systems during speculative clone | Definitely game behavior | AI adapter outside generic host; **C** |
| rendering/feedback/language | `AuthoritativeGameplayRenderer`, `GameplayFeedbackTrace`, KORE feedback enum, language catalog, background | player-facing rendering and KORE audio/presentation semantics | Not required by a headless engine | Renderer/feedback ports; move implementation outward; **C** |

**Conclusion:** `Handler.ts` is not a generic engine class in its current form. Its tick loop and orchestration portions are reusable, but its public class also owns KORE rules, items, AI, feedback, UI, map reconstruction, and defaults. This is primarily a **layering/misclassification root cause**, not evidence that generic physics or serialization fundamentally requires KORE.

### `src/engine/types.ts`

- Runtime imports: `EntityManager`, `GameSettings`.
- Type-only imports: `PlayerSettings`, `PhysicsStrategy`, system interfaces/settings, `RuleState`, `MatchResult`, item target/pickup state, physics contact state, and generic lifecycle/counter state.
- `TurnPacket.finalState` is explicitly `PlayerSettings[]`; `EngineSettings extends GameSettings` and carries KORE rule/item fields.
- `HandlerDependencies` names `EntityManager` and KORE-shaped input/item types.

The generic parts are `GameState`-like lifecycle signaling, input shape, serialization interfaces, contact/lifecycle snapshots, and system metadata. The `PlayerSettings`, `GameSettings`, item, and rule fields are data contracts (A) owned by KORE. The imports are mostly type-level and do not create runtime package coupling, but they prevent this file from being the standalone engine public contract without splitting it.

### Runtime factories and reconstruction

- `src/entity/runtimeFactory.ts`: `new Player(settings)` — one concrete player reconstruction boundary.
- `src/entity/EntityManager.ts`: creates players in the constructor, replacement path, and `addPlayer` — three concrete reconstruction uses; `instanceof Player` is also used to preserve references.
- `src/effects/runtimeFactory.ts`: `new MetaEffect(settings)` — one effect catalog reconstruction boundary; `MetaEffect` then switches over the current effect catalog.
- `src/systems/systemSettings.ts`: a switch imports and constructs the concrete system catalog, including AI/UI/environment/game-state systems. This is a registration boundary, not an algorithmic requirement.
- `src/engine/runtimeFactory.ts`: calls `new GameHandlerBuilder().defaultSystems().fromSettings(...)`; it is a KORE runtime factory despite its `engine` path.

These sites follow `serialized data -> concrete KORE constructor`, and are suitable for factories/registries. The only behavior that must remain game-owned is the factory registration itself.

### System registration

`src/systems/systemSettings.ts` directly imports 21 concrete system/runtime modules and hardcodes IDs in `createSystemFromSettings`. It also has explicit AI, UI, environmental, and KORE phase knowledge.

The repository already contains `EngineSystemRegistry` in `src/engine/sdk/systemRegistry.ts`, which is metadata-only and generic. It can be reused for selection/validation. The missing boundary is an executable, trusted registration map supplied by the application, for example:

```ts
runtimeSystems.register("core.physics", settings => new PhysicsSystem(...));
```

No new content-driven executable loading is needed. The KORE application can register the allowlisted constructors. This inversion removes the direct imports from the generic restoration host while preserving stable system IDs and serialized order.

### Physics/entity runtime

Physics does not semantically understand Player, Item, Map, Hazard, or KORE rules. It operates on `IPhysics`, vectors, shapes, masses, velocities, collision roles, and participation methods.

The current coupling is:

- `PhysicsStrategy.isStatic(entity: EntityManager)` — manager-specific type (type-level).
- `PhysicsStrategy extends ISettingsSerialize<FrictionSettings>` — KORE settings shape (type-level/data).
- `defaultPhysics` accepts `EntityManager` for static checks.
- `IEntity` extends a circle physics contract but also includes KORE inventory, item effects, assets, team, and player settings.

Minimal generic contract: `PhysicsBodyCollection`/`ReadonlyArray<PhysicsBody>` for static checks, and a generic `PhysicsSettings` record. Physics is **B, generic behavior**, with two small type/data boundary changes—not a game-semantic blocker.

### Effects

`MetaEffect`/`MultiEffect` provide generic serialized-effect execution infrastructure, but the factory switch is a concrete catalog. The current primitive effects (movement, physics, position, velocity, mass, size, team, numeric, setting) are mostly reusable behavior (B); item effects and KORE official-item lowering are actual game behavior (C) and already live separately under item/KORE modules.

The smallest fix is to retain the validated serialized effect shape and replace the switch with an injected/registered effect catalog. `EngineEffectRegistry` already exists for descriptors and validation; the trusted runtime constructor map is the missing execution-side boundary. This is one root cause: **concrete effect reconstruction**, not a need to redesign effect execution.

### Replay

`src/replay/types.ts` is primarily data validation: origin snapshot, action records, and final snapshot. Its item/counter action fields are KORE data contract (A/C), but validation does not need concrete runtime classes.

`src/replay/player.ts` directly calls `kore.restoreHandler`, constructs `WinningSystem`, `GameEmitter`, chooses the KORE mode, and interprets item/rule phases. The replay algorithm (ordered action application, tick settling, seek/reset) is generic behavior (B); the current reconstruction and action adapter are game behavior (C).

Minimal fix: generic `ReplayRuntime` accepts an injected `{ restore(snapshot), apply(action), tick(), state() }` adapter. KORE supplies the existing `kore.restoreHandler`/`GameEmitter` adapter. No replay format redesign is required.

## Step 2: root causes

| Root Cause | Coupling Sites | Severity | Minimal Fix | Existing Abstraction Reusable? |
|---|---:|---|---|---|
| KORE match orchestration incorrectly housed in `engine/Handler` | 23 | Moderate | Keep a small generic tick/simulation host; move KORE rules, items, AI, renderer, feedback, defaults, and map orchestration into KORE runtime adapter | Yes: `ISystem`, `IGameContext`, capability interfaces, `EngineSystemRegistry` |
| Concrete runtime reconstruction | 8 | Moderate | Inject entity/structure/effect/runtime factories; preserve settings as canonical data | Partly: runtime factory boundaries already exist; registry execution map is missing |
| Hardcoded executable system restoration/registration | 21 import/constructor uses, 1 semantic root cause | Moderate | Application-supplied trusted system registry; keep generic metadata registry and stable IDs | Yes: `EngineSystemRegistry` |
| Game-shaped entity/settings interfaces | 7 | Moderate | Split generic physics/body/entity snapshot contracts from KORE `PlayerSettings`, inventory, assets, and rules | Partly: `IPhysics`, lifecycle contracts, and JSON-safe SDK state already exist |
| Replay reconstruction adapter | 5 | Trivial–moderate | Inject restore/action/tick adapter; keep current replay document and deterministic loop | No dedicated abstraction yet; current `ReplayPlayer` is the adapter |

The coupling-site counts overlap where one mechanism creates multiple imports. The system row intentionally reports both the 21 concrete uses and one root cause.

## Step 3: data, generic behavior, and game behavior

| Area | A: data only | B: generic runtime behavior | C: actual game behavior |
|---|---|---|---|
| Handler/settings | JSON snapshots, system settings, counters, contact/lifecycle state, map/player settings passed through | tick ordering, simulation loop, playback coordination, validation boundaries | KORE phases, item economy, AI, win/result rules, feedback, renderer, defaults |
| Entity | serialized positions, velocities, teams, inventory/effect fields | identity, ticking, drawing port, physics body, snapshot round trip | `Player`, asset icon, item inventory/effects, KORE health/death/team rules |
| Physics | friction/threshold/body values | vector math, collision, impulse, CCD, static detection | none found in solver semantics |
| Effects | `{type, typeValue, trigger}` and engine capability commands | validation, ordered composition, dispatch, lifecycle advancement | KORE catalog meanings and official items |
| Systems | stable IDs, state, explicit order | system lifecycle, capability dispatch, deterministic ordering | winning, round rules, UI/input, AI, environmental map policy |
| Replay | origin/actions/final snapshot | deterministic sequencing, seek, settlement | KORE handler restoration, item/rule action application |

## Step 4: estimated elimination impact

Using the 47 semantic sites above (with overlaps called out):

- **Move KORE orchestration out of generic Handler:** removes or reclassifies approximately **23/47** sites. These are not generic engine dependencies after the boundary is corrected.
- **Trusted runtime reconstruction registry:** removes **8/47** direct concrete-construction sites: three `EntityManager` player constructions, one player factory, one effect factory switch boundary, two Handler snapshot/map reconstruction boundaries, and one replay restoration boundary. The concrete implementations remain registered by KORE.
- **External executable system registration:** removes **21 concrete import/constructor occurrences**, representing **one architectural root cause** and approximately **10/47 additional semantic sites** after the Handler overlap is removed. It removes the KORE AI/UI/game-system knowledge from generic restoration, while retaining engine-owned systems as explicit registrations.
- **Split generic physics/entity contracts:** removes **7/47** type/data coupling sites. The physics algorithms themselves require no rewrite.
- **Replay adapter:** removes **5/47** replay reconstruction/action-adapter sites; this overlaps the runtime/Handler boundary and is not additive.

The changes do not duplicate functionality: they move KORE registration and adapters outward and reuse existing JSON snapshots, stable system IDs, capability contracts, and SDK registries.

## Root-cause totals

```text
Raw local import edges in reviewed boundary files: 164
  runtime: 106
  type-only: 58
Raw game-facing semantic coupling sites after classification: 47
Distinct architectural root causes: 5
Likely trivial fixes: 1 (replay adapter boundary, once Handler split exists)
Likely moderate fixes: 4
Actual architectural blockers: 0 identified
```

## Verdict

`EXTRACTION REQUIRES LIMITED ARCHITECTURAL DECOUPLING`

The reassessment does **not** support the earlier conclusion that generic engine behavior fundamentally depends on KORE. The strongest evidence is already present in the repository: `src/engine/sdk/**` is tested as KORE-independent, `EngineSystemRegistry` is generic, physics is expressed in generic body/vector contracts, and snapshots are data-driven.

The remaining work is not a major engine redesign. It is a bounded separation of the KORE match orchestrator from the generic host, inversion of executable system registration, and injection of reconstruction/replay adapters. Until those changes are made, a full source-level standalone repository is not yet validated; however, the cause is limited architectural decoupling rather than irreducible Engine -> Game semantics.
