# AGENTS.md

This file is the starting point for humans and coding agents working in this
repository. It describes the project as it currently exists. When this guide,
the design documents, and the implementation disagree, treat current source
code and verified tests as authoritative.

## Project Summary

Slipstrike (the package is still named `game`, and the browser title is
`KORE`) is a prototype turn-based 2D arena tactics game. Players drag and
release circular figures across slippery arenas, resolving movement and
collisions as a deterministic, frame-counted physics simulation.

The intended product is documented in the German `gdd.md`: optional items,
one aimed shot, a no-input physics phase, turn switching, out-of-bounds
elimination, data-driven maps/items, AI, multiplayer, replays, and modding.
Only part of that design is implemented. The current playable prototype has:

- A custom TypeScript engine rendered with p5.js.
- An 800 x 450 ice map with a configurable two-sided penguin/polar-bear layout
  (six figures per side by default).
- Drag-to-shoot mouse input (100 world units maps to power 10).
- Circle/circle and circle/rectangle collision handling.
- Per-entity movement, friction, and serializable effects.
- Local hotseat turns, shared active-team progression, simulation playback,
  and a final hard sync.
- An SQLite-backed authoritative Bun HTTP/WebSocket server with persistent
  matchmaking, reconnect restoration, and browser network startup.
- Death-circle effects, dead-player exclusion, and a working local-play menu.
- A separate map-editor prototype.

Items, AI, winning and completed-round rules, general out-of-bounds
elimination, and touch/controller input are not implemented end to end. Do not
infer behavior from planning documents or checkboxes without verifying source
and tests.

## Source Of Truth

- `src/` is the authoritative game, engine, and server-library source.
- Root `server.ts` is the Bun server entry point.
- `tests/` is the Bun test suite, although several files are empty, commented,
  or weakly asserted.
- `src-website/` is an independent vanilla HTML/CSS/JS map-editor prototype.
- `public/` contains browser assets and editor example data.
- `gdd.md` describes product intent, not guaranteed implementation.
- `TODO.md` is a reconciled planning inventory; current source and verified
  tests remain authoritative.
- `requirements.md` maps TODO/GDD requirements to implementation checklist
  sections and the test evidence required for completion.
- `step-by-step.md` is the current commit-sized execution checklist. Update its
  status in the same atomic commit as each completed task.
- `dist/` is ignored generated JavaScript and generated asset data. It may be
  stale and may contain files that no longer have source counterparts.
- `docs/` is tracked generated TypeDoc output. It is stale and references old
  modules and symbols; never use it as current API truth.
- `README.md` is currently empty.
- `package-lock.json` is stale and describes an old React/Vite/Socket.IO graph.
  `package.json` plus the tracked `bun.lock` describe the active dependency
  graph. Use Bun; do not casually run npm install or regenerate either lock.

Always inspect `git status` before editing. The worktree may contain unrelated
human or agent changes. Preserve them and never clean, reset, or rewrite files
outside the requested scope.

After every change, check whether this guide still reflects the implementation
and tests. Update `AGENTS.md` in the same change when it is no longer accurate.

## Repository Map

### Runtime entry points

- `index.html`: browser shell; loads vendored `public/p5.min.js` and generated
  `dist/main.js`.
- `src/main.ts`: browser bootstrap, menu/game selection, p5 setup, render loop,
  DOM mouse events, keyboard audio controls, and `window.game` debug access.
- `server.ts`: Bun static-file and native WebSocket server, in-memory lobby,
  and matchmaking loop.
- `src/start.ts`: disabled/commented network-client prototype.
- `src-website/index.html`: standalone map-editor page.
- `src-website/js/editor-draft.js`: browser-safe validated temporary-draft
  storage and in-place restore for the editor's shared `mapData` object.

### Engine and gameplay source

- `src/engine/Handler.ts`: central orchestration. `GameHandler` owns context,
  entities, systems, structures, effects, input forwarding, simulation,
  playback, active-team/turn progression, serialization, and local rematch.
  `GameHandlerBuilder` constructs handlers.
- `src/engine/types.ts`: game states, input, turn packets, engine snapshots,
  mouse contracts, and settings serialization contracts.
- `src/engine/RenderContext.ts`: renderer abstraction.
- `src/engine/drawingEngine.ts`: p5 implementation of `RenderContext` and
  world-to-pixel scaling.
- `src/engine/gameOptions.ts`: older game-option types; not the active settings
  model.

### Game rules

- `src/rules/types.ts`: serializable game-mode, rule-phase, and match-result
  contracts. It intentionally does not depend on `GameHandler`.
- `src/rules/RuleInterpreter.ts`: advances the data-defined rule-phase sequence
  and active-team order without mutating simulation state. Its optional item
  phase starts a turn and enforces its configured per-turn allowance. Staged
  modes require `aim`, `charge`, `push`, then `physics`; the live combined-input
  mode remains physics-only.
- `src/rules/defaultGameModes.ts`: transitional data-defined modes shared by
  local and authoritative turn flows. Modes include serializable item-economy
  settings for fixed loadouts, map pickups, and seeded draw pools.

### Entities, effects, and items

- `src/entity/Player.ts`: the runtime puck/figure. Construct it with a complete
  `PlayerSettings` snapshot and serialize it with `toSettings()`.
- `src/entity/Entity.ts` and `src/entity/types.ts`: entity and snapshot
  contracts.
- `src/entity/EntityManager.ts`: storage, ID lookup, click hit testing,
  snapshots, ticking, and drawing.
- `src/entity/DebugPlayer.ts`: debug entity behavior.
- `src/effects/types.ts`: `EffectType`, `EffectTrigger`, and serialized effect
  shapes.
- `src/effects/effects.ts`: `MetaEffect`, the serialized-type factory.
- `src/effects/*.ts`: movement, friction/physics, damage, and mass/position/
  size/team/velocity modifiers.
- `src/item/types.ts`: versioned item, inventory, pickup, target, duration, and
  use-limit schemas with create helpers and structural validation functions.
- `src/item/validate.ts`: strict declarative item validator. It requires an
  explicitly registered effect-name whitelist, allows only JSON data in effect
  values, and rejects executable fields and unknown schema fields.
- `src/item/loader.ts`: stores built-in and local-mod item documents through the
  same validator, prevents duplicate IDs, and returns defensive copies.
- `src/item/inventory.ts`: initializes fixed team loadouts and enforces
  per-turn/per-game inventory consumption; player snapshots preserve counters.
- `src/item/Items.ts` and `src/item/minimalItem.ts`: incomplete item contracts.
- `src/item/ItemAnker.ts`, `ItemCollector.ts`, and `ItemWall.ts`: empty or
  commented placeholders; item gameplay is not active.

### Physics, structures, and systems

- `src/physics/physics.ts`: vector and physics contracts plus numeric `SHAPE`
  values (`CIRCLE`, `LINE`, `RECTANGLE`).
- `src/physics/defaultPhysics.ts`: vector operations, friction, impulse,
  stop prediction, collision detection, and collision response.
- `src/structures/types.ts`: structure contracts and exports.
- `src/structures/fullStructure.ts`: settings-to-runtime structure adapter.
- `src/structures/structureCircle.ts`, `structureRectangle.ts`, and
  `structureLine.ts`: concrete geometry. Line support is incomplete.
- `src/structures/DeadlyObstacleCircle.ts` and `DebuggerStructure.ts`: special
  or debug structures.
- `src/systems/types.ts`: `IGameContext`, `ISystem`, playback, and simulator
  contracts.
- `src/systems/PhysicsSystem.ts`: entity/entity and entity/structure collision
  iteration; movement and friction are currently entity effects, not this
  system.
- `src/systems/UiSystem.ts`: converts mouse drag into actor, angle, and power;
  only permits selection by the active team.
- `src/systems/Emitter.ts`: sends completed input through an `IInputEmitter`.
- `src/systems/PlayBackSystem.ts`: counts simulated frames and hard-syncs the
  final position and velocity.
- `src/systems/GameStateManager.ts`: incomplete state transitions.
- `src/systems/TurnSystem.ts`: client turn-state mapping for controlled teams.
- `src/systems/DirectionArrow.ts`: shot-direction overlay.
- `src/systems/RoundSystem.ts`, `WinningSystem.ts`, `BoundarySystem.ts`,
  `EffectSystem.ts`, `Simulator.ts`, and related helpers: partial, placeholder,
  or archival implementations. Verify each before relying on it.

### Settings, rendering, menus, and assets

- `src/settings/settings.ts`: canonical `GameSettings`, friction presets,
  default teams/entities, active settings object, and grid arrangement.
- `src/settings/iceMap.ts`: active map geometry, background, spawn regions, and
  structure effects.
- `src/settings/cueClashMap.ts`, `frostbiteArenaMap.ts`, and
  `magmaCradleMap.ts`: scalable validated canonical map factories with world
  sizes independent of render dimensions. Magma Cradle uses loaded force and
  kill-zone collision hazards.
- `src/settings/billiardMap.ts` and `src/settings/test.ts`: commented/archival
  map content.
- `src/ui/Background.ts` and `CustomDrawableBackground.ts`: backgrounds.
- `src/ui/Mouse.ts`: mostly disabled mouse prototype.
- `src/ui/UiStrategy.ts`: deprecated UI strategy.
- `src/ui/mapbuilder.ts` and `src/ui/types.ts`: UI/map helper contracts.
- `src/menu/Menu.ts`: landing and menu pages.
- `src/menu/AudioManager.ts`: browser playlist using ignored MP3 files.
- `src/assetManager/assets/assetRegistry.ts`: generated numeric asset enum and
  path map, but tracked because source code imports it.
- `src/assetManager/loader.ts`: lazy browser image fetch/cache with a currently
  misaligned JSON fallback path.
- `scripts/createAssetPack.ts`: scans public images, rewrites the asset
  registry, and emits base64 JSON packs under `dist/`.
- `scripts/listAssets.ts`: stale diagnostic whose paths do not match the
  current generator.

### Networking and utilities

- `src/server/types.ts`: JSON wire protocol and packet types.
- `src/server/server.ts`: login helpers.
- `src/server/db.ts`: explicit SQLite game store. It gzip-compresses complete
  `EngineSettings` snapshots and maintains player-to-game membership rows.
- `src/server/gameRegistry.ts`: authoritative match cache, turn ownership,
  input checks, simulation commits, rule progression, persistence, and lazy
  SQLite restoration.
- `src/server/runtime.ts`: testable WebSocket protocol runtime, login binding,
  matchmaking, input dispatch, and broadcasts.
- `src/server/game.ts`, `shoot.ts`, and `utils.ts`: archival/stubbed code not
  used by the active server runtime.
- `src/emitter/EngineEmitter.ts`: local hotseat input path; simulates, plays,
  advances its data-defined rule state, and then advances the active team.
- `src/emitter/NetworkEmitter.ts`: sends shot requests and applies
  authoritative `TURN` playback and active-team updates.
- `src/emitter/InputEmitter.ts`, `ObjectEmitter.ts`, and `ReplayEmitter.ts`:
  emitter composition, test capture, and replay-oriented helpers.
- `src/utils/net.ts`: unguarded JSON wrap/unwrap.
- `src/utils/random.ts`: deterministic pseudo-random source for replayable
  gameplay decisions.
- `src/utils/id.ts`: `localStorage` user/game IDs; not used by current startup.
- `src/utils/ErrorHandling.ts`: error utility.
- `src/utils/log.ts`: commented logger prototype.
- `src/types/global.d.ts`: browser globals including `window.game`.

## Toolchain And Setup

The active toolchain is Bun, ESM, TypeScript 5.9, and p5.js. Install with:

```sh
bun install --frozen-lockfile
```

Useful commands:

```sh
bun test               # all Bun-discovered tests
npx tsc --noEmit       # strict check of src/**/* without changing dist
bun run build          # compile src/**/* to dist; does not clean stale files
bun run start          # run Bun HTTP/WebSocket server
bun run dev            # server plus TypeScript watch compiler
bun run watch:ts       # compile src continuously
bun run serve          # live-server only; no WebSocket backend
bun run createAssets   # intentionally regenerate registry and asset packs
```

There is no lint or formatting script. CI currently runs only
`bun install --frozen-lockfile` and `bun test`, and only targets the `main`
branch. `tsconfig.json` includes only `src/**/*`; root `server.ts`, tests,
scripts, and `src-website/` are not typechecked by `npx tsc --noEmit`.

The root `.env` currently sets `PORT=4001`; the server fallback is 3000.

## Browser Workflow

The browser always runs generated `dist/main.js`, not `src/main.ts` directly.
After source changes, run `bun run build` or use `bun run dev`. Because `tsc`
does not clean `dist`, remove stale output only when explicitly safe and never
as part of an unrelated change.

The default URL opens the menu. Local gameplay is selected with a non-empty
`skipmenu` query parameter, for example:

```text
http://localhost:4001/?skipmenu=1
```

Query values are assigned as strings, so even `?skipmenu=false` is truthy.
`url` selects the WebSocket server for network gameplay; `mapbuilder` is parsed
but currently unused.

The browser runtime is the vendored p5 file in `public/` (currently p5
1.11.x), while `package.json` declares p5 2.x and the typings are 1.7.x.
Account for this mismatch when changing rendering APIs.

## Runtime Flow

### Startup and systems

`GameHandlerBuilder.defaultSystems()` installs systems in this order:

1. `PlaybackSystem`
2. `PhysicsSystem`
3. `GameStateManager`

The local gameplay branch in `src/main.ts` adds `UiSystem`, `DirectionArrow`,
and `EmitterSystem`; `defaultSystems()` remains the sole registration point for
physics and playback. The network branch waits for the server `INIT` settings,
then installs the same UI systems with `NetworkEmitter`.

`GameHandlerBuilder.fromSettings()` installs the background, teams, players,
wrapped map structures, handler effects, items, and map friction. It restores
engine state, turn number, and active team when given `EngineSettings`.

### Per-frame update order

`GameHandler.tick()` executes:

1. Pre-tickers.
2. Handler-level always effects on every entity.
3. Every entity's `tick()`.
4. Systems in registration order.
5. Structure ticks.
6. Post-tickers.

`Player.tick()` delegates movement to `EffectMove` and friction to
`EffectPhysics`. `PhysicsSystem` resolves collisions and zeros very low
speeds; despite its comments, it does not integrate positions or apply
friction itself.

### Input, simulation, and playback

1. `UiSystem` stores mouse-down and mouse-up world positions.
2. Only while in `Your_turn`, it accepts pointer events and selects an
   active-team entity under the initial click; simulation and playback reject
   new input.
3. Drag distance maps to power 0-10; direction is opposite the drag vector.
4. It writes `ctx.mouse.turn` and changes state to `Turn_done`.
5. `EmitterSystem` sends the shot and changes state to `Waiting_for_server`.
6. Local `GameEmitter` calls `simulateTurn()` and then `tickTurn()`.
7. `simulateTurn()` serializes and clones the engine, applies the impulse, and
   ticks until static or 1,200 frames.
8. `tickTurn()` applies the live impulse and starts playback for that frame
   count.
9. `PlaybackSystem` hard-syncs positions and velocities to the simulated final
   state.

`GameHandler.advanceTurn()` owns deterministic active-team progression and
increments the turn number. Local hotseat calls it after playback begins; the
server calls it only after accepting and resolving an authoritative shot, then
broadcasts the resulting active team to clients.

System order and fixed frame counts are part of the current determinism model.
Physics or effect changes need deterministic regression tests.

## Data Contracts

The canonical engine map/game model is `GameSettings` in
`src/settings/settings.ts`. Important fields are:

- `screenResolution: { x, y }`
- `players: PlayerSettings[]`
- `mapBoundarys`: numeric circle/line/rectangle shape settings
- `background`: color or numeric `AssetList` image
- `friction: { friction, linearDrag, stopThreshold }`
- `drift`: finite `[0, 1]` per-tick, speed-preserving steering blend toward each
  player's rotation; it does not apply at or below the physics stop threshold
- `playerCount` and `figuresPerPlayer`: positive integer match-layout settings;
  they serialize with engine snapshots. `createDefaultGameSettings()` generates
  the two-sided ice-map layout from them.
- handler `effects`, `items`, teams, and player-count metadata

Versioned game/map/item/hazard/AI/replay document contracts live in
`src/contracts/documents.ts`; legacy documents without a version migrate to
schema version one, while unknown versions are rejected.
`validateGameSettings()` rejects malformed settings before an untrusted load
boundary admits them.
`ItemValidator` in `src/item/validate.ts` adds the item-load security boundary:
callers must register each supported declarative effect name before validation;
the validator rejects unknown fields, executable keys, and non-JSON effect data.
`ItemLoader` uses that same validator for built-in and local-mod documents, so
neither source can bypass the declarative item boundary.
Canonical map documents carry world size, friction, drift, geometry, spawn regions,
hazard references, and metadata. `loadMapDocument()` converts force and kill-zone
collision hazards into serializable runtime structure effects; other hazard types
remain unsupported.

`EngineSettings` adds game state, turn number, active team, serialized rule
state, match result, and runtime entity snapshots. Persisted game snapshots must
preserve all turn and rule-progress fields.
`GameModeSettings` can carry an `ItemEconomySettings` contract for fixed
per-team loadouts, declared map pickups, and deterministic seeded draw pools;
the selected optional mode is preserved in engine snapshots.
Seeded item-draw state is also preserved in engine snapshots so reconnect and
replay restoration resume the configured deterministic draw pool.
`TurnPacket` contains `actorId`, `{ angle, power }`, `durationFrames`, and final
entity state.

Effects serialize as `{ type, typeValue, trigger, triggerValue }`. The factory
in `MetaEffect` must be updated whenever a new serializable effect is added.
`EffectModifySetting` provides constrained serializable `set`, `add`, and
`remove` mutations for allowlisted player settings such as `hp` and `dead`.
`PlayerSettings` is the canonical complete entity snapshot; use
`createPlayerSettings()` to create defaults, then `new Player(settings)`. Test
both behavior and `new Player(player.toSettings()).toSettings()` round trips.

The map editor's `mapData`/`public/map.json` format is not `GameSettings`:
editor players, shapes, and hazard names remain distinct even though editor
friction uses the engine `FrictionSettings` shape. Validate it with
`validateEditorMapDocument()` and convert it through `convertEditorMapDocument()`;
never pass editor JSON directly to `GameHandlerBuilder.fromSettings()`. The
converter creates padded per-team spawn regions, maps walls/holes and supported
rectangular push/kill collision zones, preserves the engine template background,
and rejects items, customized mode/AI, and slide/sticky zones.

Numeric `AssetList` values appear in serialized settings. Regenerating the
registry can reorder values and silently remap persisted/networked assets.
Treat registry order changes as data-contract changes.

## Coding Conventions

- Keep the project ESM. Production source normally imports emitted `.js`
  paths from `.ts` files; preserve `.js` suffixes unless changing the module
  strategy deliberately.
- Prefer `import type` for type-only dependencies.
- Follow the existing class/interface architecture: `GameHandler`, `ISystem`,
  `IEntity`, `PhysicsStrategy`, `RenderContext`, and settings adapters.
- Keep runtime-to-data boundaries explicit through `toSettings()` and
  `fromSettings()`.
- Preserve system registration and tick order unless the behavior change is
  intentional and tested.
- Source TypeScript generally uses tabs and semicolons, but style is mixed and
  there is no formatter. Match the surrounding file and avoid unrelated
  formatting.
- German and English names/comments coexist. Use clear English for new public
  APIs unless matching an established domain term.
- Avoid adding `@ts-ignore`. Existing ignores often hide genuine ownership or
  binding issues.
- Do not add large compatibility layers for commented or generated code.
- Do not edit `dist/` manually. Build it from `src/` when browser verification
  is needed.
- Do not hand-edit `docs/`; regenerate it deliberately with TypeDoc if current
  documentation is part of the task.
- Do not commit `node_modules/`, `dist/`, audio files, databases, logs, or
  generated base64 asset JSON.

## Testing Guidance

Run at minimum after source changes:

```sh
bun test
npx tsc --noEmit
```

Add focused Bun tests near the relevant behavior. Existing test names use both
`*.test.ts` and `*_test.ts`, and imports inconsistently use `.ts`, `.js`, or no
extension. Prefer `bun:test` and the production import convention for new
tests.

Do not mistake test discovery for strong coverage. Some active tests have no
assertions, and several files are empty or mostly commented. `tests/fullGame.ts`
and `tests/auto-play.ts` are not normal discovered test files. Do not run
`tests/auto-play.ts` casually: it uses stale constructors and writes
`output.log`.

For changes in these areas, explicitly cover:

- Collision formulas and deterministic final positions.
- Settings and effect round trips.
- A first shot using real map structures.
- State transitions and system order.
- Active-team progression, snapshot restoration, and client turn-state mapping.
- Menu event delegation.
- Editor-to-engine conversion if one is introduced.
- Network packet validation and disconnect/matchmaking cleanup.

## Assets And Generated Files

`bun run createAssets` is a mutating, potentially data-breaking operation. It:

- Recursively scans image files under `public/`.
- Rewrites tracked `src/assetManager/assets/assetRegistry.ts`.
- Writes large ignored base64 JSON files under
  `dist/assetManager/assets/json/json/`.

The generator does not explicitly sort files or clean old JSON output. Its
filename splitting mishandles multiple dots. The loader currently requests a
different JSON fallback path. Run it only for intentional asset work, inspect
the registry diff carefully, and test serialized asset values.

`public/audio/` is ignored and is absent from a fresh clone, but
`AudioManager` expects ten `CM_*.mp3` files there. Missing audio is expected.

## Server And Networking Safety

The network stack uses native `Bun.serve` WebSockets and an SQLite-backed match
store. `ServerRuntime` derives the sender from the logged-in socket, validates
a `SHOOT` request, commits it through the authoritative `GameHandler`, advances
the turn revision, stores the compressed `handler.toSettings()` snapshot, and
broadcasts the resulting `TURN` packet and rule state to both players. An
authoritative `REMATCH` resets the handler and broadcasts fresh per-player
`INIT` settings. `GameHandler` objects
are an evictable cache: the final disconnect removes them immediately and idle
handlers are removed after one minute; the next turn/reconnect restores them
from SQLite. The database path is `GAME_DB_PATH` or `./data/kore.db`.

Do not trust values from a `SHOOT` packet. `GameRegistry` must continue to
validate finite angle/power ranges, actor ownership/activity, game membership,
and turn ownership before resolving a turn. Keep the registry/runtime testable
by injecting `new GameDatabase(":memory:")`.

Be careful when running `bun run start`:

- The static handler serves only `index.html`, `public/`, and `dist/`; continue
  to keep secrets out of this repository and do not broaden that allowlist
  casually.
- The production server writes `./data/kore.db` by default. `*.db` is ignored;
  do not commit database files. Set `GAME_DB_PATH` for another durable path.

## Known High-Impact Limitations

Verify these before building on the affected code; they are current behavior,
not desired design:

- `Player.setMass()` clamps values above one and rejects non-finite or
  non-positive mass.
- Positive `EffectDamage` values reduce HP, and HP at or below zero marks a
  player dead. Death circles use `EffectModifySetting` to set `dead: true`.
  Dead players no longer render, tick, collide, accept selection, or resolve a
  turn; settings snapshots preserve their dead state. Match-end input is
  blocked, but winning evaluation is not yet integrated into round progression.
- Round effects are stored but not meaningfully executed. Circle and rectangle
  collision effects execute, including converted editor push and kill zones.
- `EffectType.Multi` currently falls back to movement, not a true multi-effect.
- Outer circle/rectangle containment is inferred from mixed structures; line
  segments are collision obstacles only. Leaving an inferred containment
  boundary kills a player; a last-team-standing evaluator exists but is not yet
  integrated into completed-match flow.
- The p5 mouse-wheel handlers may lose `this`, and mouse tracking depends on a
  browser-created `defaultCanvas0` global.
- The editor stores one validated temporary draft in browser `localStorage` and
  restores it on startup; its embedded and popup previews use the current
  browser origin.
- Imported editor map values are rendered with DOM construction, `textContent`,
  and control `.value` assignments; do not reintroduce template interpolation
  for untrusted map data.

## Change Checklist

Before finishing a change:

1. Read the relevant source and tests; do not rely on `docs/` or `TODO.md`.
2. Check `git status` and preserve unrelated modifications.
3. Keep generated output and source changes clearly separated.
4. Add or update tests for behavior and serialization boundaries.
5. Run `bun test` and `npx tsc --noEmit`.
6. If browser behavior changed, build and test the generated `dist/main.js`
   path, including `?skipmenu=1` when gameplay is required.
7. If server/editor/scripts changed, verify them separately because the main
   TypeScript project does not check them.
8. Report commands run, failures, generated files, and any known unverified
   behavior.
