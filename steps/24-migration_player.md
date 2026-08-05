# Task: Migrate Player Creation and Configuration from the Legacy System to the New SDK

Implement a staged migration of the KORE player domain from direct legacy construction to the new SDK architecture.

The migration must be incremental, test-driven, reversible during development, and must preserve current gameplay behavior, serialization, determinism, replay compatibility, save/load behavior, AI behavior, networking, rendering, and browser integration.

Do not replace the entire player implementation in one step.

The goal is to make the SDK the authoritative public authoring and reconstruction boundary for players while allowing the existing runtime `Player` implementation to remain temporarily behind an adapter.

---

# Primary objective

Replace direct production usage such as:

```ts
new Player(...)
```

or:

```ts
const player: PlayerSettings = {
  // manually constructed legacy fields
};
```

with a stable SDK-facing API such as:

```ts
const player = kore.player({
  id: "player-blue-1",
  teamNr: 0,
  position: { x: 120, y: 180 },
  radius: 20,
  health: 100,
});
```

or, if the current builder conventions favor factories:

```ts
const player = kore.createPlayer({
  id: "player-blue-1",
  teamNr: 0,
  position: { x: 120, y: 180 },
});
```

The SDK output must remain canonical, detached, JSON-safe settings.

Runtime construction should happen through a dedicated KORE runtime factory or adapter:

```ts
const runtimePlayer = koreRuntime.createPlayer(playerSettings);
```

The public authoring SDK must not return mutable runtime `Player` instances.

---

# Architectural target

Preserve this dependency direction:

```text
Canonical generic entity contracts
        ↓
Generic Engine SDK authoring
        ↓
KORE Player SDK authoring
        ↓
Canonical KORE PlayerSettings
        ↓
KORE runtime player factory
        ↓
Legacy Player runtime implementation
```

The SDK must become the stable boundary.

The legacy runtime class may remain temporarily as an internal implementation detail.

Production code must gradually stop importing and constructing the legacy player directly.

---

# Layer responsibilities

## Generic Engine SDK

The generic Engine SDK may define generic entity capabilities such as:

* identity;
* position;
* velocity;
* health;
* collision shape;
* render metadata;
* serializable component records;
* capability identifiers;
* generic effects;
* generic entity metadata.

It must not define:

* KORE team numbers;
* turn ownership;
* KORE item inventory;
* KORE player colors;
* KORE player defaults;
* KORE-specific spawn rules;
* KORE shot power;
* KORE victory rules;
* KORE AI ownership;
* KORE HUD concepts.

## KORE SDK

The KORE SDK owns:

* player defaults;
* team membership;
* KORE player validation;
* KORE collision and material defaults;
* KORE health defaults;
* KORE gameplay capabilities;
* KORE player effects;
* KORE inventory integration;
* KORE spawn semantics;
* conversion to canonical `PlayerSettings`;
* compatibility with existing KORE maps and game settings.

## KORE runtime layer

The runtime layer owns:

* construction of the runtime `Player`;
* mutable runtime state;
* physics integration;
* collision behavior;
* gameplay methods;
* effect application;
* runtime caches;
* renderer-facing runtime state;
* conversion back to canonical settings.

The runtime factory may initially delegate to the existing legacy constructor.

---

# Non-negotiable constraints

* Do not introduce KORE dependencies into `src/engine/sdk/**`.
* Do not move runtime behavior into serializable SDK builders.
* Do not serialize callbacks, class instances, systems, renderers, sockets, browser objects, or functions.
* Do not change simulation behavior during the authoring migration.
* Do not silently change default values.
* Do not change player IDs or team numbering.
* Do not change replay action formats unless explicitly versioned.
* Do not break old saved games without an explicit compatibility strategy.
* Do not duplicate the canonical `PlayerSettings` schema.
* Do not create a second manually maintained player schema.
* Do not let SDK authoring objects become authoritative mutable runtime state.
* Do not perform a repository-wide replacement before compatibility tests exist.

---

# Required initial audit

Before changing code, inspect and document all current player construction and reconstruction paths.

Search for at least:

```text
new Player(
PlayerSettings
createPlayer
playerFrom
fromSettings
toSettings
players:
myTeam
allTeams
playerCount
spawn
PlayerBuilder
GameHandlerBuilder
```

Classify every occurrence into one of these categories:

1. canonical settings definition;
2. SDK authoring;
3. map generation;
4. game-mode construction;
5. runtime construction;
6. snapshot reconstruction;
7. replay reconstruction;
8. AI setup;
9. network deserialization;
10. server/headless construction;
11. browser/local match construction;
12. tests and fixtures;
13. rendering-only access;
14. gameplay mutation.

Create a migration table:

| Location | Current construction path | Desired SDK path | Runtime behavior risk | Migration phase |
| -------- | ------------------------- | ---------------- | --------------------- | --------------- |

Do not start broad edits until this audit is complete.

---

# Phase 1: Establish canonical player ownership

Confirm the existing canonical player settings contract.

Prefer the existing canonical `PlayerSettings` as the serialization boundary if it already contains the required state.

Do not create a replacement contract merely to match the desired SDK API.

## Checklist

* [x] Locate the authoritative `PlayerSettings` definition.
* [x] Identify all required serialized fields.
* [x] Identify optional fields and their defaults.
* [x] Identify runtime-only fields that must not be serialized.
* [x] Identify fields derived during construction.
* [x] Identify fields that must remain stable for replay compatibility.
* [x] Identify fields used by save/load.
* [x] Identify fields used by networking.
* [x] Identify fields used by AI.
* [x] Identify fields used by rendering.
* [x] Identify legacy aliases or deprecated fields.
* [x] Confirm whether schema versioning already exists.
* [x] Document the exact canonical lifecycle.

Expected lifecycle:

```text
SDK input
→ normalized PlayerSettings
→ JSON
→ runtime Player
→ runtime mutation
→ Player.toSettings()
→ canonical PlayerSettings
```

The SDK-built settings and runtime-produced settings must use the same canonical contract.

---

# Phase 2: Separate generic entity data from KORE player data

Audit which player fields are genuinely generic.

Potential generic capabilities may include:

```ts
interface EntityIdentitySettings {
  id: string;
}

interface PositionSettings {
  x: number;
  y: number;
}

interface VelocitySettings {
  x: number;
  y: number;
}

interface HealthSettings {
  current: number;
  maximum: number;
}

interface CircleColliderSettings {
  radius: number;
}
```

Use the repository’s existing component and capability contracts where available.

Do not force a component redesign merely to complete the migration.

## Checklist

* [x] Identify existing generic entity contracts.
* [x] Reuse existing position contracts.
* [x] Reuse existing health contracts.
* [x] Reuse existing collision-shape contracts.
* [x] Reuse existing material or physics contracts where generic.
* [x] Avoid introducing parallel vector or geometry types.
* [x] Keep team ownership in KORE.
* [x] Keep turn-state concepts in KORE.
* [x] Keep KORE item state in KORE.
* [x] Keep game-specific render vocabulary outside the Engine SDK.
* [x] Add only missing generic authoring helpers that are independently useful.
* [x] Add architecture tests preventing reverse dependencies.

The Engine SDK should be able to author a generic entity without knowing that it is a player.

Example:

```ts
const entity = engine.createEntity({
  id: "entity-1",
  capabilities: {
    position: { x: 120, y: 180 },
    health: { current: 100, maximum: 100 },
    collider: { type: "circle", radius: 20 },
  },
});
```

Adapt this example to the current SDK architecture rather than inventing a conflicting component model.

---

# Phase 3: Add the KORE player authoring API

Add a public KORE SDK player factory or builder.

Choose one API style consistent with the current SDK.

Preferred simple factory:

```ts
const player = kore.createPlayer({
  id: "blue-1",
  teamNr: 0,
  position: { x: 120, y: 180 },
});
```

Possible advanced builder:

```ts
const player = kore
  .createPlayer({
    id: "blue-1",
    teamNr: 0,
  })
  .at({ x: 120, y: 180 })
  .withHealth(100)
  .withRadius(20)
  .build();
```

Do not implement a fluent builder unless it adds real value and matches existing SDK conventions.

## Required behavior

The public API must:

* produce canonical `PlayerSettings`;
* apply KORE defaults;
* validate team membership;
* validate geometry;
* validate health;
* validate IDs;
* detach caller-owned input;
* emit no runtime class instances;
* remain JSON-safe;
* produce deterministic output;
* expose no browser or runtime dependencies;
* preserve explicit user-provided values;
* reject unsupported fields;
* avoid hidden global state.

## Checklist

* [x] Add the public SDK input type.
* [x] Add `kore.createPlayer()` or the chosen equivalent.
* [x] Reuse canonical `PlayerSettings`.
* [x] Normalize optional values.
* [x] Clone mutable nested records.
* [x] Validate finite position values.
* [x] Validate positive collision dimensions.
* [x] Validate health ranges.
* [x] Validate team number.
* [x] Validate stable non-empty ID.
* [x] Validate JSON safety.
* [x] Apply exact existing defaults.
* [x] Document every applied default.
* [x] Export the API through `src/kore/sdk/index.ts`.
* [x] Preserve the deprecated compatibility entry if currently required.
* [x] Add public API examples.

---

# Phase 4: Introduce a dedicated runtime player factory

Do not let arbitrary code continue calling the legacy player constructor.

Add one runtime construction boundary, for example:

```ts
export interface KorePlayerRuntimeFactory {
  create(settings: PlayerSettings): Player;
}
```

or:

```ts
export function createRuntimePlayer(
  settings: PlayerSettings
): Player {
  return new Player(settings);
}
```

Place this in the KORE runtime layer, not in the generic Engine SDK authoring layer.

The initial implementation may wrap the legacy constructor exactly.

## Checklist

* [x] Add one authoritative runtime player factory.
* [x] Make it accept canonical `PlayerSettings`.
* [x] Make it validate or normalize only where currently required.
* [x] Delegate to the existing legacy constructor initially.
* [x] Add a runtime round-trip test.
* [x] Confirm no SDK builder returns runtime instances.
* [x] Confirm runtime-only dependencies remain outside the SDK.
* [x] Add a deprecation comment to direct legacy construction paths where appropriate.
* [x] Prevent new direct construction in production code through an architecture test or lint-style test.

Target production rule:

```text
Production code may construct runtime players only through the KORE runtime factory.
```

Tests may temporarily retain direct construction until their migration phase.

---

# Phase 5: Establish parity tests before migration

Create a golden parity suite comparing legacy construction with SDK construction.

For representative player configurations:

```ts
const legacySettings = createLegacyPlayerSettings(input);
const sdkSettings = kore.createPlayer(input);

expect(sdkSettings).toEqual(legacySettings);
```

Then compare runtime behavior:

```ts
const legacyRuntime = new Player(legacySettings);
const sdkRuntime = createRuntimePlayer(sdkSettings);

expect(sdkRuntime.toSettings()).toEqual(
  legacyRuntime.toSettings()
);
```

## Required parity cases

* [x] default player;
* [x] explicit ID;
* [x] team 0;
* [x] team 1;
* [x] custom position;
* [x] custom velocity;
* [x] custom radius or collision shape;
* [x] custom health;
* [x] dead player;
* [x] active effects;
* [x] inventory state if player-owned;
* [x] render metadata if canonical;
* [x] snapshot reconstruction;
* [x] JSON round-trip;
* [x] effect round-trip;
* [x] representative old save fixture;
* [x] representative replay initial settings;
* [x] representative network payload.

Do not begin production migration until parity is demonstrated.

---

# Phase 6: Migrate map and spawn authoring

Migrate map-generated players first because this is an authoring concern and should have relatively low runtime risk.

Existing paths may currently:

* manually construct `PlayerSettings`;
* duplicate defaults;
* assign team numbers directly;
* calculate IDs manually;
* materialize players from spawn regions.

Move player materialization behind the KORE SDK.

Example target:

```ts
const players = kore.createPlayersForSpawn({
  team,
  spawn,
  count,
  defaults,
});
```

or:

```ts
const player = kore.createPlayer({
  id: createSpawnPlayerId(teamNr, index),
  teamNr,
  position,
});
```

Do not add a bulk factory unless it removes genuine duplicated behavior.

## Checklist

* [ ] Locate all map player materialization.
* [ ] Identify duplicated defaults.
* [ ] Migrate one map path first.
* [ ] Compare generated settings byte-for-byte or structurally.
* [ ] Preserve player ordering.
* [ ] Preserve generated IDs.
* [ ] Preserve spawn positions.
* [ ] Preserve team assignment.
* [ ] Preserve equal-team validation.
* [ ] Preserve map JSON output.
* [ ] Migrate remaining map paths.
* [ ] Remove duplicated map-level player defaults.
* [ ] Keep spawn calculation logic separate from player construction where appropriate.

---

# Phase 7: Migrate game-mode and match setup

Migrate local, AI, battle, online, test, and default game setup paths individually.

Recommended order:

1. default SDK map construction;
2. local match;
3. human-versus-AI;
4. battle mode;
5. online match settings;
6. headless/server match;
7. test-only custom match factories.

## Checklist per path

* [ ] Capture the current produced settings.
* [ ] Replace manual player settings with SDK player authoring.
* [ ] Preserve player array order.
* [ ] Preserve team order.
* [ ] Preserve active-team selection.
* [ ] Preserve seeded IDs.
* [ ] Preserve all defaults.
* [ ] Run mode-specific unit tests.
* [ ] Run replay tests.
* [ ] Run snapshot tests.
* [ ] Run browser coverage where applicable.
* [ ] Commit or record the migration independently before moving to the next path.

Do not combine every game-mode migration into one unreviewable change.

---

# Phase 8: Migrate runtime reconstruction

Migrate all settings-to-runtime paths to the dedicated runtime factory.

Likely locations include:

* `GameHandlerBuilder`;
* `fromSettings()`;
* snapshot restoration;
* replay initialization;
* server match construction;
* client match reconstruction;
* database restore;
* browser/local scene creation.

## Checklist

* [ ] Locate every direct runtime player constructor call.
* [ ] Replace the first low-risk constructor call with the runtime factory.
* [ ] Verify `toSettings()` parity.
* [ ] Verify systems receive the same runtime capabilities.
* [ ] Verify physics registration remains unchanged.
* [ ] Verify collision registration remains unchanged.
* [ ] Verify player ordering remains unchanged.
* [ ] Verify effect registration remains unchanged.
* [ ] Verify team references remain stable.
* [ ] Migrate snapshot reconstruction.
* [ ] Migrate replay reconstruction.
* [ ] Migrate network reconstruction.
* [ ] Migrate server/headless reconstruction.
* [ ] Migrate browser/local reconstruction.
* [ ] Remove production direct constructor imports.
* [ ] Add an architecture test preventing their return.

The runtime factory must not create different behavior merely because construction is centralized.

---

# Phase 9: Migrate mutation APIs carefully

The SDK should author initial state, but gameplay mutation must continue through runtime systems and authoritative gameplay APIs.

Do not mutate SDK settings after runtime construction.

Avoid patterns such as:

```ts
sdkPlayer.health = 0;
```

Runtime changes should remain:

```ts
runtimePlayer.applyDamage(...);
```

or system-driven equivalents.

## Checklist

* [ ] Identify code mutating `PlayerSettings` after runtime construction.
* [ ] Classify legitimate pre-construction normalization.
* [ ] Replace runtime settings mutation with runtime APIs.
* [ ] Keep projection code read-only.
* [ ] Keep serialization through `toSettings()`.
* [ ] Keep effects system-driven.
* [ ] Keep death-state authority in gameplay systems.
* [ ] Keep inventory authority in gameplay systems.
* [ ] Keep team authority in game state.
* [ ] Ensure SDK objects remain detached data.
* [ ] Add tests proving caller input mutation does not mutate built settings.
* [ ] Add tests proving built settings mutation does not mutate runtime state after construction.

---

# Phase 10: Migrate rendering and UI consumers to capabilities

Rendering and UI code should not require direct access to the concrete legacy `Player` class where a narrow capability is sufficient.

Examples of possible narrow views:

```ts
interface PlayerRenderView {
  id: string;
  position: Vec2;
  radius: number;
  teamNr: number;
  isDead: boolean;
}
```

or existing structural capabilities.

Do not introduce a new view interface if appropriate capability interfaces already exist.

## Checklist

* [ ] Find `instanceof Player` checks.
* [ ] Find concrete `Player` type dependencies in renderers.
* [ ] Find concrete `Player` dependencies in UI projections.
* [ ] Find concrete `Player` dependencies in systems.
* [ ] Replace safe cases with structural capabilities.
* [ ] Skip unsupported entities safely.
* [ ] Preserve player-specific rendering in the KORE renderer.
* [ ] Do not move render styles into generic settings.
* [ ] Preserve HUD projection output.
* [ ] Preserve aim and active-player indicators.
* [ ] Preserve browser rendering behavior.

This phase improves the SDK architecture but must not alter game rules.

---

# Phase 11: Migrate AI consumers

AI should receive canonical game state or narrow player views rather than constructing legacy players.

## Checklist

* [ ] Locate AI player construction.
* [ ] Locate AI cloning or simulation state.
* [ ] Ensure simulated players reconstruct from canonical settings.
* [ ] Route runtime reconstruction through the factory.
* [ ] Preserve deterministic seeds.
* [ ] Preserve player ordering.
* [ ] Preserve legal action validation.
* [ ] Preserve AI decision output.
* [ ] Run deterministic AI tests.
* [ ] Run replay comparison tests.
* [ ] Confirm AI does not mutate SDK authoring objects.

---

# Phase 12: Migrate networking and server paths

Network boundaries must continue to exchange canonical versioned settings, not runtime classes or SDK builder instances.

## Checklist

* [ ] Confirm network payloads use canonical settings.
* [ ] Confirm SDK builders are never serialized directly.
* [ ] Validate received player settings.
* [ ] Reconstruct through the runtime factory.
* [ ] Preserve protocol field names.
* [ ] Preserve protocol versions.
* [ ] Preserve participant ownership.
* [ ] Preserve authoritative server validation.
* [ ] Preserve rejection behavior.
* [ ] Preserve snapshot hashes or deterministic comparisons.
* [ ] Test malformed player payload rejection.
* [ ] Test old supported payload fixtures.
* [ ] Test complete online match reconstruction.
* [ ] Confirm no browser-only dependency enters server code.

---

# Phase 13: Save, load, replay, and compatibility migration

Player migration is incomplete unless old persisted data remains supported according to the project’s compatibility policy.

## Checklist

* [ ] Load an existing saved-game fixture.
* [ ] Reconstruct all players through the new runtime factory.
* [ ] Save again through `toSettings()`.
* [ ] Compare canonical output.
* [ ] Replay an existing replay fixture.
* [ ] Verify deterministic final state.
* [ ] Verify player IDs.
* [ ] Verify health and death state.
* [ ] Verify effects.
* [ ] Verify inventory.
* [ ] Verify team ownership.
* [ ] Verify active player state.
* [ ] Verify current turn state.
* [ ] Verify database snapshot restoration.
* [ ] Document any intentionally unsupported legacy version.
* [ ] Add a versioned migration only if required.
* [ ] Never silently reinterpret old fields.

---

# Phase 14: Deprecate the legacy public construction path

Once all production paths use the SDK and runtime factory:

* mark direct legacy constructors as internal where feasible;
* stop exporting them from public SDK entry points;
* retain compatibility wrappers only where required;
* add tests preventing new production imports.

## Checklist

* [ ] Search again for direct `new Player(...)`.
* [ ] Classify remaining test-only uses.
* [ ] Remove production direct construction.
* [ ] Remove duplicate player settings factories.
* [ ] Remove duplicate default constants.
* [ ] Remove obsolete adapters.
* [ ] Mark compatibility exports deprecated.
* [ ] Add an architecture boundary test.
* [ ] Update SDK documentation.
* [ ] Update examples.
* [ ] Update `AGENTS.md` or architecture guidance if applicable.

Do not delete the legacy runtime implementation merely because its constructor is no longer public.

It may remain the runtime implementation behind the new factory until a separate runtime-component migration is justified.

---

# Phase 15: Optional runtime component migration

Treat this as a separate phase after SDK authoring migration is complete.

Only perform it if the existing `Player` runtime class remains a meaningful architectural problem.

Possible later target:

```text
Canonical PlayerSettings
→ generic entity runtime
→ composed capabilities/components
→ KORE player behavior facade
```

Potential capabilities:

* position;
* velocity;
* collision;
* health;
* effects;
* team membership;
* inventory;
* turn participation;
* rendering;
* serialization.

Do not force this phase into the initial SDK migration.

## Checklist

* [ ] Confirm authoring migration is complete first.
* [ ] Measure remaining coupling to the concrete `Player`.
* [ ] Identify systems that already use structural capabilities.
* [ ] Identify methods that require a behavior facade.
* [ ] Define component ownership.
* [ ] Preserve canonical serialization.
* [ ] Preserve runtime identity.
* [ ] Preserve deterministic system order.
* [ ] Migrate one capability at a time.
* [ ] Retain compatibility facade during transition.
* [ ] Remove the legacy class only after all parity tests pass.

---

# Required public API design

Provide a final API proposal before implementation.

It should show:

```ts
const playerSettings = kore.createPlayer({
  id: "blue-1",
  teamNr: 0,
  position: { x: 120, y: 180 },
});
```

Also show explicit customization:

```ts
const playerSettings = kore.createPlayer({
  id: "blue-1",
  teamNr: 0,
  position: { x: 120, y: 180 },
  velocity: { x: 0, y: 0 },
  health: {
    current: 80,
    maximum: 100,
  },
  radius: 20,
  effects: [],
});
```

And runtime reconstruction:

```ts
const player = createKoreRuntimePlayer(playerSettings);
```

The exact API may differ if repository conventions require it, but the separation must remain:

```text
SDK authoring data !== runtime object
```

---

# Required generic and KORE tests

## SDK authoring tests

* [ ] default construction;
* [ ] explicit construction;
* [ ] input detachment;
* [ ] JSON safety;
* [ ] canonical output;
* [ ] invalid ID rejection;
* [ ] invalid team rejection;
* [ ] invalid position rejection;
* [ ] invalid health rejection;
* [ ] invalid geometry rejection;
* [ ] unsupported value rejection;
* [ ] deterministic repeated build;
* [ ] effects serialization;
* [ ] inventory serialization if applicable.

## Runtime factory tests

* [ ] canonical settings to runtime;
* [ ] runtime to canonical settings;
* [ ] JSON round-trip;
* [ ] dead-state reconstruction;
* [ ] effect reconstruction;
* [ ] inventory reconstruction;
* [ ] collision shape reconstruction;
* [ ] no shared mutable settings references;
* [ ] equivalent legacy and factory behavior.

## Gameplay parity tests

* [ ] accepted shot;
* [ ] movement;
* [ ] collision;
* [ ] damage;
* [ ] death;
* [ ] boundary behavior;
* [ ] effect application;
* [ ] turn transitions;
* [ ] victory detection;
* [ ] item use;
* [ ] snapshot restore.

## Integration tests

* [ ] local game;
* [ ] human versus AI;
* [ ] battle mode;
* [ ] online game;
* [ ] server/headless game;
* [ ] replay;
* [ ] saved-game restore;
* [ ] browser local match;
* [ ] browser online match where coverage exists.

## Architecture tests

* [ ] Engine SDK does not import KORE.
* [ ] KORE authoring SDK does not import browser code.
* [ ] KORE authoring SDK does not import scene routers.
* [ ] Generic contracts do not import SDK builders.
* [ ] Production code does not directly instantiate legacy players.
* [ ] Network code does not serialize runtime player objects.
* [ ] SDK output contains no functions or class instances.

---

# Migration execution checklist

## Audit

* [ ] Map every player construction path.
* [ ] Map every player reconstruction path.
* [ ] Map every direct legacy constructor import.
* [ ] Map every player settings mutation.
* [ ] Map every persisted and network boundary.
* [ ] Record baseline test results.
* [ ] Record representative canonical player snapshots.

## SDK foundation

* [ ] Confirm canonical `PlayerSettings`.
* [ ] Separate generic and KORE-owned fields.
* [ ] Add KORE SDK input type.
* [ ] Add KORE player factory.
* [ ] Add validation.
* [ ] Add normalization.
* [ ] Add JSON round-trip tests.
* [ ] Add parity tests.

## Runtime boundary

* [ ] Add runtime player factory.
* [ ] Wrap legacy constructor.
* [ ] Add runtime parity tests.
* [ ] Prevent new production direct construction.

## Authoring migration

* [ ] Migrate default player generation.
* [ ] Migrate map generation.
* [ ] Migrate spawn materialization.
* [ ] Migrate local-match setup.
* [ ] Migrate AI-match setup.
* [ ] Migrate battle setup.
* [ ] Migrate online settings.
* [ ] Migrate test factories.

## Reconstruction migration

* [ ] Migrate `GameHandlerBuilder`.
* [ ] Migrate `fromSettings()`.
* [ ] Migrate snapshot restoration.
* [ ] Migrate replay initialization.
* [ ] Migrate network reconstruction.
* [ ] Migrate server reconstruction.
* [ ] Migrate browser reconstruction.

## Consumer migration

* [ ] Migrate renderer dependencies where safe.
* [ ] Migrate UI projection dependencies where safe.
* [ ] Migrate system dependencies to capabilities where safe.
* [ ] Migrate AI simulation cloning.
* [ ] Preserve runtime gameplay authority.

## Compatibility

* [ ] Verify old save fixtures.
* [ ] Verify old replay fixtures.
* [ ] Verify supported network fixtures.
* [ ] Verify deterministic final states.
* [ ] Document version compatibility.
* [ ] Add migration logic only where necessary.

## Cleanup

* [ ] Remove duplicate player factories.
* [ ] Remove duplicate defaults.
* [ ] Remove production direct constructors.
* [ ] Deprecate compatibility exports.
* [ ] Update architecture tests.
* [ ] Update SDK docs.
* [ ] Update examples.
* [ ] Run the full test suite.

---

# Required implementation order

Follow this exact high-level order:

1. Audit the repository.
2. Capture existing player settings fixtures.
3. Confirm the canonical player schema.
4. Define the final SDK API.
5. Implement the SDK factory without migrating production callers.
6. Implement parity tests.
7. Implement the runtime factory around the legacy player.
8. Migrate one map-authoring path.
9. Run focused and full tests.
10. Migrate remaining map and spawn paths.
11. Migrate local-match setup.
12. Migrate AI setup.
13. Migrate battle and online setup.
14. Migrate runtime reconstruction.
15. Migrate save/load and replay reconstruction.
16. Migrate network and server construction.
17. Migrate browser construction.
18. Replace safe concrete-player dependencies with capabilities.
19. Remove obsolete direct construction.
20. Update documentation and architecture enforcement.
21. Provide a final migration report.

At each migration step:

* change one coherent path;
* run focused tests;
* run relevant integration tests;
* compare canonical settings;
* record behavioral parity;
* do not continue if parity is broken.

---

# Explicit non-goals

Do not include these in the first migration unless independently required:

* rewriting the entire ECS;
* deleting the legacy `Player` runtime class;
* changing physics behavior;
* changing turn rules;
* changing health semantics;
* changing team semantics;
* changing player IDs;
* changing map formats;
* changing replay formats;
* changing network protocols;
* changing renderer appearance;
* changing HUD behavior;
* replacing all systems at once;
* introducing runtime reflection;
* introducing global registries;
* adding browser dependencies to the SDK;
* adding callbacks to canonical settings.

The first migration is about ownership, construction, validation, and boundaries.

---

# Completion criteria

The migration is complete only when:

* the KORE SDK exposes a stable public player authoring API;
* the SDK produces canonical `PlayerSettings`;
* the SDK applies documented KORE defaults;
* the SDK output is detached and JSON-safe;
* runtime player creation goes through one KORE runtime factory;
* production code no longer directly constructs legacy players;
* map and game-mode authoring use the SDK;
* save/load, replay, AI, networking, server, and browser reconstruction use the runtime factory;
* existing gameplay behavior remains unchanged;
* existing player ordering and IDs remain unchanged;
* old supported snapshots and replays still work;
* no KORE concept enters the generic Engine SDK;
* no runtime object enters canonical settings;
* parity, architecture, unit, integration, and browser tests pass;
* the legacy runtime player is either internal or retained only through an explicitly documented compatibility boundary.

---

# Final report format

After implementation, provide the following report.

## 1. Architecture audit

List all identified legacy player construction and reconstruction paths.

## 2. Final public SDK API

Show the implemented player authoring API with examples.

## 3. Canonical ownership

Explain which data belongs to:

* generic Engine SDK;
* KORE SDK;
* canonical settings;
* runtime player;
* renderer;
* gameplay systems.

## 4. Migration table

For each migrated path, report:

| Path | Previous implementation | New implementation | Tests |
| ---- | ----------------------- | ------------------ | ----- |

## 5. Compatibility

Report:

* save compatibility;
* replay compatibility;
* network compatibility;
* schema changes;
* default-value changes;
* ID and ordering preservation.

## 6. Legacy status

List:

* removed legacy factories;
* retained compatibility adapters;
* remaining direct constructor usages;
* reason for each remaining usage.

## 7. Tests

List exact commands and results for:

* type checking;
* formatting or linting;
* SDK tests;
* player parity tests;
* gameplay tests;
* replay tests;
* save/load tests;
* AI tests;
* networking tests;
* browser tests;
* complete test suite.

## 8. Remaining limitations

List only concrete remaining migration work.

Do not claim the legacy player has been removed if it is still used behind the runtime factory.
