# Final Engine Architecture Audit

Audit baseline: `0c3aee0 docs(items): record final item convergence`

CocoIndex: 734 files / 7,403 chunks

Final audit index after audit tests/documentation: 735 files / 7,426 chunks

This is a read-only ownership audit plus focused Actor Eligibility contract
coverage. No production refactor was performed. Current source and verified
tests remain authoritative.

## Architecture Inventory

| Domain | Canonical representation | Owner | Interpreter / advancement | Qualified consumers |
|---|---|---|---|---|
| Movement | JSON-safe movement Effects/commands | Player/world state | `MovementSystem` / tick | Freeze-Shot, Magnet, Delayed Mine |
| Transform | Stable entity/structure transform commands | Entity/Structure | `TransformSystem` | Switch, Falltür |
| Participation | `participation.set-physics`, `set-drawing` | Player/Structure | `ParticipationSystem` | Elimination, StructureLifecycle |
| Numeric | Entity numeric state and threshold bindings | Player | `NumericSystem` | Damage, shields, elimination |
| Action Modifier | `pendingActionModifiers` | Player | Handler accepted-action boundary | Power-Dash, Anker, Vodka-Zero |
| Lifetime | Flat duration/countdown fields | Each feature owner | Pure `lifetime.ts` helpers; owner advances | Temporal, action, structure, deferred, collision, eligibility |
| Temporal Modifier | `temporalModifiers` | Player | Handler accepted-action application / turn advancement | Freeze-Shot |
| Deferred Effect | `deferredEffects` | GameHandler | Handler tick scheduler | Delayed Mine |
| Structure Lifecycle | `structureLifecycles` plus retained Structure | GameHandler / Structure | Handler expiry, ParticipationSystem mutation | Mini-Wall |
| Collision Filter | `collisionFilters` plus separate lifetimes | Player | `PhysicsSystem` pair boundary | Ghost Mode |
| Actor Eligibility | `actorEligibilityConstraints` plus separate lifetimes | Player | Handler shared actor validation | Selection Lock |
| Trigger | JSON-safe activation events | Owning host | Trigger dispatcher / host | Falltür, deferred effects, replay events |
| Dispatcher | Stable predefined command routing | Engine context | `predefinedEffectDispatcher` | Generic command families |

Historical migration enters through `migrateGameSettingsEffects()` before
strict runtime reconstruction. Runtime objects are reconstructed from
canonical state; transient callbacks and solver caches are not authoritative.

## Findings

### P0

None found. No confirmed correctness, determinism, or duplicate-authority
failure requires an immediate production fix.

### P1

- **Persisted structure identity uses array indexes in two systems.**
  `PhysicsSystem.registerContactIdentities()` serializes structure contact keys
  as `structure:${index}` (`src/systems/PhysicsSystem.ts:221-228`).
  `EnvironmentalSystem` persists `structureIndexes` and resolves through
  `ctx.structures[index]` (`src/systems/EnvironmentalSystem.ts:9-30`). Stable
  structure IDs already exist, so insertion/reordering can change restored
  contact or environmental targets. This is deferred remediation, not changed
  in this audit.

### P2

- **Player record/lifetime management is repeated.** Temporal modifiers,
  action modifiers, collision filters, and actor eligibility each repeat
  cloning, validation, source removal, stable sorting, lifetime advancement,
  and conditional serialization. The repetition is typed and currently
  correct, but a narrow internal record/lifetime helper may reduce risk later.
- **`Player` snapshot defensive copying is incomplete.** `getTeam()` and the
  `team` field returned by `toSettings()` are direct array references
  (`src/entity/Player.ts:214`, `270-304`). This is a snapshot isolation hardening
  candidate; no observed gameplay failure was found.
- **Detached Player callbacks are runtime dependencies.** Numeric dispatch is
  stored as a callback and reattached by `GameHandler`; an independently
  reconstructed Player cannot execute numeric effects without its host
  callback. The callback is intentionally non-canonical, but the dependency
  should be documented or narrowed later.
- **Handler responsibility concentration.** Handler owns tick orchestration,
  snapshots, rule progression, item lowering, reward orchestration, deferred
  scheduling, structure lifecycles, AI construction, and feedback. These are
  valid orchestration boundaries, not a correctness violation. Incremental
  extraction is deferred until ownership pressure or testability requires it.
- **Runtime item lowering returns private templates and selected runtime
  objects.** `createRuntimeItemEffect()` is the KORE lowering boundary, but its
  return union mixes canonical templates with current `EffectShield` and
  `EffectSpawnTrigger` runtime objects. The Handler immediately supplies stable
  IDs and ownership. This is safe internally but should not expand as a public
  runtime API.
- **Default player IDs are generated with `crypto.randomUUID()`.** This is
  session-level authoring nondeterminism, not hidden gameplay RNG because
  replay snapshots preserve the generated IDs and match seeds. It remains a
  canonical-authoring hardening candidate because IDs also influence stable
  derived seeds.

### P3

- `src/effects/types.ts` intentionally remains the KORE item/runtime contract
  boundary and therefore imports item target types. This is packaging/domain
  coupling, not leakage into the generic `src/engine/sdk` contracts.
- `EffectSystem` is a placeholder and `RoundPlayerSystem` is deprecated beside
  `RuleInterpreter`; both remain restoreable for historical compatibility.
- `isDead()` remains a transitional projection over participation flags.
- Broad historical comments and old helper names remain in Handler and Effects.
- First-consumer restrictions in some generic-looking templates, such as
  rectangle-only StructureLifecycle data, are documented extensibility debt.

## Handler Audit

Valid ownership includes tick/rule orchestration, snapshot/restore, accepted
action transformation, shared actor eligibility, lifecycle advancement,
predefined dispatch, replay orchestration, and KORE item lowering.

No direct Handler mutation of velocity, position, HP, collision resolution, or
generic participation mechanics was found that bypasses a qualified System.
Structure lifecycle creation is the intentional Handler lifecycle-host path;
inventory changes use inventory helpers. Wunderkiste remains the documented
KORE-specific reward orchestration exception.

Active-team ownership remains separate from actor eligibility: server and
emitters enforce team/phase authority, while Handler enforces active/dead and
`actorEligibilityConstraints`. Direct engine resolution of an otherwise valid
actor outside transport team validation remains intentional and covered by
engine tests.

The Handler is broad, but decomposition by line count is rejected. Any future
extraction must preserve the single accepted-action and actor-validation
boundaries.

## Player State Audit

| Family | Stable records | Separate lifetime | Source removal | Stable ordering | Validation | Advancement | Interpreter |
|---|---:|---:|---:|---:|---:|---:|---|
| `temporalModifiers` | yes | embedded record | yes | source/order | yes | Player/Handler turn | Handler + dispatcher |
| `pendingActionModifiers` | yes | optional turns | yes | source/order | yes | Player/Handler turn | Handler accepted action |
| `collisionFilters` | yes | separate records | yes | source/order | yes | Player/Handler turn | PhysicsSystem |
| `actorEligibilityConstraints` | yes | separate records | yes | source/order | yes | Player/Handler turn | Handler validator |
| `numericThresholds` | yes | no | no | declared order | yes | event/state crossing | NumericSystem |
| `itemEffects` | source/order | effect-specific | yes | source/order | yes | effect-specific | current Shield/SpawnTrigger/other KORE paths |

Player ownership is legitimate: these are entity-local state families that must
survive snapshot, replay, AI, and network restoration. A universal heterogeneous
state bag is rejected. A typed `EntityOwnedRecords` helper is **useful later**
but not justified now without first proving identical serialization and expiry
semantics across more consumers.

## Structure Audit

Structures own geometry, stable ID, role, collision commands, and participation
flags. Handler owns StructureLifecycle timing; expiry dispatches generic
participation commands and retains the dormant Structure. No Item-specific
Structure state or solver ownership was found.

The persisted index identity findings above are the only structural ownership
risk requiring future remediation.

## Effects Audit

| Classification | Current examples | Decision |
|---|---|---|
| Current generic/core runtime | `runtimeFactory`, `MetaEffect`, movement/numeric/transform Effects | Retain; current dispatcher boundaries are valid. |
| Current KORE lowering/runtime | Shield and SpawnTrigger runtime objects; `itemRuntime.ts` | Retain as the private KORE lowering boundary. |
| Compatibility/helper only | `EffectAimVariance`, `EffectGhostMode`, `EffectSelectionLock`, legacy official helpers | Retain while historical fixtures/public compatibility require them; no current official Item installs them. |
| Migration only | `src/migrations/effects.ts`, `migrateItemDocument()` | Retain as the single historical boundary. |
| Obsolete executable legacy path | None confirmed for qualified migrated Items | No deletion performed. |

`itemEffects` remains valid for current runtime effects such as Shield and
SpawnTrigger and for retained KORE behavior. Qualified migrated Items do not
have dual ownership in `itemEffects` plus their generic state family.

## Systems Audit

Systems have clear generic responsibilities: Movement, Numeric, Counter,
Transform, Participation, Physics, Boundary, Winning, and predefined dispatch.
No official Item IDs or names were found in generic System implementations.

`EffectSystem` and `RoundPlayerSystem` are compatibility/deprecated paths, not
active duplicate interpreters in the qualified default flow. Removing them is
deferred until serialized system-ID compatibility is explicitly retired.

## Invariant Results

- **Actor Eligibility:** PASS. Only `mode: "excluded"` exists; constraint/lifetime IDs are cross-validated; source metadata affects provenance/order/removal, not `isActorEligible()`; no constraints means eligible.
- **Collision Filter:** PASS. Filtering precedes resolution, depenetration, contact tracking, and entry dispatch; movement, drawing, boundaries, and non-collision hazards remain orthogonal.
- **Action Modifier:** PASS. Operations remain `force.scale` and `aim.random-offset`; ordering is source order then stable ID; Player lifetimes are turns only.
- **Lifetime:** PASS. The shared core validates and advances arithmetic only; owners perform expiry/removal/meaning.
- **Trigger:** PASS. Trigger events are activation signals, not persistent lifetime or consumption storage.
- **Identity:** CONDITIONAL. Entity and canonical Structure IDs are stable; persisted environmental and physics structure indexes remain P1 debt.
- **Determinism:** PASS for gameplay RNG. `SeededRandom` and persisted state are used for gameplay decisions. Session IDs, timestamps, asset cache busting, and initial match seed generation are non-gameplay/session concerns. Default generated Player IDs remain P2 authoring debt.

## Migration Audit

| Historical semantic | Old representation | Current representation | Boundary | Current old execution |
|---|---|---|---|---|
| Force modifier | `itemEffects.modifyForce` | `pendingActionModifiers.force.scale` | `migrateGameSettingsEffects()` | No |
| Aim variance | `itemEffects.aimVariance` / `EffectAimVariance` | `pendingActionModifiers.aim.random-offset` | `migrateGameSettingsEffects()` | No |
| Ghost Mode | `itemEffects.ghostMode` / `EffectGhostMode` | `collisionFilters` + lifetimes | `migrateGameSettingsEffects()` | No |
| Selection Lock | `itemEffects.selectionLock` / `EffectSelectionLock` | `actorEligibilityConstraints` + lifetimes | `migrateGameSettingsEffects()` | No |
| Magnet / Switch | legacy Item effect payloads | Engine movement/transform commands | `migrateItemDocument()` | No |

Wunderkiste is retained KORE meaning, not a failed migration: reward-pool
interpretation remains in KORE while deterministic inventory grant mechanics
remain reusable.

## Decisions

### Player State Management

- Repeated mechanics: clone/validate/order/source removal/lifetime advancement
  across several typed families.
- Intentional differences: action consumption, relation predicates, target
  ownership, tick/turn units, and interpreter boundaries differ materially.
- Candidate helper: a private typed record/lifetime helper could own mechanical
  bookkeeping only.
- Decision: **defer**. Implementing it now risks hiding semantic differences and
  provides no proven serialization migration benefit.

### Handler Decomposition

- Decision: **defer**. Responsibilities are broad but valid orchestration and
  authority boundaries; no extraction has a demonstrated ownership correction.

### Effects Cleanup

- Current generic runtime: core `EffectSettings` and predefined Engine commands.
- Current KORE runtime: Shield/SpawnTrigger lowering and retained KORE effects.
- Compatibility-only: AimVariance, GhostMode, SelectionLock helpers/classes.
- Migration-only: historical effect normalization.
- Safe removals now: none without public/historical compatibility evidence.
- Decision: **retain** compatibility paths and keep the lowering boundary private;
  revisit only with an explicit API/version migration.

### Systems Cleanup

- Clear single responsibility: Movement, Numeric, Counter, Transform,
  Participation, Physics, Boundary, Winning, and predefined dispatch.
- Overlap: deprecated RoundPlayerSystem and placeholder EffectSystem only.
- Decision: **defer removal** until persisted system-ID compatibility is retired.

## Prioritized Remediation

1. P1: replace persisted PhysicsSystem and EnvironmentalSystem structure indexes
   with stable Structure IDs, with migration and snapshot tests.
2. P2: harden Player snapshot defensive copies and detached callback/document
   contracts.
3. P2: decide whether default Player IDs should be deterministic at canonical
   authoring boundaries.
4. P2/P3: consider a typed record/lifetime helper only after another consumer
   demonstrates identical mechanics.
5. P3: retire deprecated system IDs and legacy public runtime exports only under
   explicit compatibility/version policy.

## Explicitly Rejected Refactors

- Universal Item/effect/policy DSL or heterogeneous Player state bag.
- Moving active-team authority into Player actor eligibility.
- Removing Wunderkiste’s KORE orchestration special case.
- Splitting Handler solely by size.
- Destructive test consolidation in this architecture audit.

## Audit Status

No P0 remediation was required. The repository is ownership-audited with
intentional P1/P2/P3 debt classified above. A future remediation slice should
address stable Structure IDs before broad record-container or Handler
decomposition work.
