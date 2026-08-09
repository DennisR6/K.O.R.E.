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

AI, winning and completed-round rules, out-of-bounds elimination, replays,
desktop packaging, and security validation are implemented and verified with
automated coverage. Gameplay release qualification remains conditional: the
Section 15 record retains blocked configurations and known item/AI limitations,
and external human playtest evidence is still pending.
Items, AI, winning and completed-round rules, out-of-bounds elimination are
fully implemented and verified at their automated contract boundaries; this
does not promote blocked gameplay configurations or pending human evidence.

## Hybrid ECS/OOP Architecture

The engine uses a hybrid Entity Component System (ECS) and Object-Oriented Programming (OOP) architecture.

Serializable component data serves as the canonical game state, while runtime objects provide a convenient, behavior-oriented API during execution.

Every runtime object follows a deterministic lifecycle:

- Construct from serialized state.
- Execute gameplay behavior.
- Serialize back into an equivalent snapshot.

This bidirectional lifecycle guarantees that runtime state is always reproducible from its serialized representation, enabling deterministic save/load, multiplayer synchronization, replays, AI simulation, rollback, and state validation without coupling gameplay logic to serialization or networking.

## Source Of Truth

- `src/` is the authoritative game, engine, and server-library source.
- Root `server.ts` is the Bun server entry point.
- `tests/` is the Bun test suite, covering all core systems, item economy, AI, networking, persistence, security, and platforms.
- `src-website/` is an independent vanilla HTML/CSS/JS map-editor prototype.
- `public/` contains browser assets and editor example data.
- `gdd.md` describes product intent, and implementation is completed across all master phases.
- `TODO.md` is a reconciled planning inventory; current source and verified tests remain authoritative.
- `requirements.md` maps TODO/GDD requirements to implementation checklist sections and verified test evidence.
- `step-by-step.md` is the compact completed-delivery record. Keep its milestone
  summaries and commit links accurate when a material delivery changes them.
- `dist/` is ignored generated JavaScript and generated asset data. It may be stale and may contain files that no longer have source counterparts.
- `sdk/` contains generated standalone ESM runtime bundles and TypeScript declarations for the generic Engine, UI, Audio, Presentation, and KORE SDK entry points. Regenerate it with `bun run sdk:build`; do not edit generated files manually.
- `docs/` contains technical documentation guides (`docs/README.md`) and generated TypeDoc API documentation.
- `docs/performance-testing.md` documents the committed performance baseline
  contract; `performance/baselines.json` is checked by
  `bun run test:performance` and updated only by the explicit
  `bun run performance:update` command.
- `docs/item-convergence.md` is the durable current Item Convergence inventory and ranking. After each completed Item migration, refresh CocoIndex, rerank remaining official Items from repository evidence, update that document with the baseline commit, and select the next Item only from the refreshed ranking.
- `README.md` provides project overview, quickstart, installation, usage commands, and gameplay modes.
- `package-lock.json` is stale and describes an old React/Vite/Socket.IO graph. `package.json` plus the tracked `bun.lock` describe the active dependency graph. Use Bun; do not casually run npm install or regenerate either lock.

Always inspect `git status` before editing. The worktree may contain unrelated human or agent changes. Preserve them and never clean, reset, or rewrite files outside the requested scope.

After every change, check whether this guide still reflects the implementation and tests. Update `AGENTS.md` in the same change when it is no longer accurate.

## Repository Map

### Runtime entry points

- `index.html`: browser shell; loads vendored `public/p5.min.js` and generated `dist/main.js`.
- `src/main.ts`: browser bootstrap, menu/game selection, accessible online
  connection/matchmaking loading and recovery UI, p5 setup, render loop, DOM
  mouse events, keyboard audio controls, and `window.game` debug access.
- `src/engine/startupTelemetry.ts`: bounded browser startup timing and asset
  aggregate observations exposed through `window.game.startup`; it remains
  runtime-only and never enters canonical settings, fingerprints, or replays.
- `src/debug/uiSandbox.ts`: standalone p5 host for the generic UI SDK debug
  sandbox. It activates only with `?debug=ui` (or `?debugui=1`) and keeps the
  browser adapter and diagnostics outside the generic SDK.
- `server.ts`: Bun static-file and native WebSocket server, in-memory lobby,
  matchmaking loop, and the validated `/offline-matches` upload route backed by
  the SQLite offline-match store.
- `src-website/index.html`: standalone map-editor page. `bun run mapbuilder:dev`
  runs its live-server workflow; the typed development source is
  `src/content/debugMap.ts` and `bun run build:debug-map` writes its validated
  editor document to `public/map.json`.
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

- `src/entity/Player.ts`: the runtime puck/figure. Construct it through the authoritative `createRuntimePlayer()` factory in `src/entity/runtimeFactory.ts` and serialize it with `toSettings()`.
- `src/entity/runtimeFactory.ts`: single KORE runtime player factory boundary (`createRuntimePlayer`). Production code constructs runtime players exclusively through this adapter.
- `src/kore/sdk/index.ts`: KORE SDK entry point exposing `kore.createPlayer()` / `createPlayer()` for authoring detached canonical `PlayerSettings` snapshots.
- `src/entity/Entity.ts` and `src/entity/types.ts`: entity and snapshot
  contracts.
- `src/entity/EntityManager.ts`: storage, ID lookup, click hit testing,
  snapshots, ticking, and drawing.
- `src/entity/DebugPlayer.ts`: debug entity behavior.
- `src/effects/types.ts`: `EffectType`, `EffectTrigger`, and serialized effect
  shapes.
- `src/effects/effects.ts`: `MetaEffect` (the hardened serialized-type factory that rejects unknown types) and `MultiEffect` (a true ordered multi-effect over child settings).
- `src/effects/runtimeFactory.ts`: single KORE runtime effect factory boundary (`createRuntimeEffect`). Production code constructs runtime effects exclusively through this adapter.
- `src/effects/*.ts`: movement, friction/physics, damage, and mass/position/
  size/team/velocity modifiers.
- `src/effects/triggerDispatcher.ts`: internal validated activation bridge for
  handler, Player, MovementSystem, and circle/rectangle structure trigger paths;
  it also dispatches typed `round.start` activations at `GameHandler.startTurn()`;
  it does not alter serialized Effect settings.
- `src/effects/modifyRotation.ts`: serializable additive rotation modifier for
  item actions, with deterministic angle normalization.
- `src/effects/lockRotation.ts`: serializable turn-counted rotation lock with
  snapshot-safe expiration state.
- `src/effects/applyTorque.ts`: serializable additive angular update primitive
  with deterministic rotation normalization.
- `src/effects/spawnTrigger.ts`: serializable turn-counted trigger primitive
  with snapshot restoration state.
- `src/engine/contracts/deferredEffect.ts`: generic JSON-safe one-shot Engine
  effect execution state with stable identity and deterministic tick expiry.
- `src/engine/contracts/lifetime.ts`: shared flat JSON-safe duration/countdown
  mechanics for TemporalModifier, StructureLifecycle, and DeferredEffect. It
  performs pure validation and one-step advancement only; lifecycle owners keep
  their own time boundaries and expiry behavior.
- `src/effects/shield.ts`: serializable damage-absorbing shield with collision
  blocking and snapshot-safe capacity state.
- `src/engine/contracts/temporalModifier.ts`: generic JSON-safe persistent
  modifier state with stable entity targets and deterministic turn expiry.
- `src/engine/contracts/structureLifecycle.ts`: generic JSON-safe timed
  canonical-structure lifecycle with stable IDs, retained dormant structures,
  and deterministic turn expiry.
- `src/engine/contracts/collisionFilter.ts`: generic JSON-safe entity-owned
  collision relation exclusions with separately persisted turn lifetimes and a
  pure pair-eligibility predicate. `PhysicsSystem` applies it before collision
  resolution and entry dispatch; it does not alter boundary elimination.
- `src/engine/contracts/actorEligibility.ts`: generic JSON-safe entity-owned
  actor exclusions with separately persisted turn lifetimes and a pure
  eligibility predicate. `GameHandler.validateActorForAction()` is the shared
  local, AI, replay, and server authority boundary.
- `src/effects/swapPosition.ts`: reusable validated teleport/swap primitive for
  active entity positions.
- `src/item/types.ts`: versioned item, inventory, pickup, target, duration, and
  use-limit schemas with create helpers and structural validation functions.
- `src/item/validate.ts`: strict declarative item validator. It requires an
  explicitly registered effect-name whitelist, allows only JSON data in effect
  values, and rejects executable fields and unknown schema fields.
- `src/item/loader.ts`: stores built-in and local-mod item documents through the
  same validator, prevents duplicate IDs, and returns defensive copies.
- `src/item/sdkItemFactory.ts`: leaf-module `createItem`/`composeItemEffects`
  item-document authoring used by both the public KORE SDK and the official
  item catalog. Keeping it outside `kore/sdk/index.ts` breaks the
  `modeCatalog -> kore/sdk/match -> engine/Handler -> officialItems ->
  kore/sdk/index` module cycle.
- `src/item/inventory.ts`: initializes fixed team loadouts and enforces
  per-turn/per-game inventory consumption; player snapshots preserve counters.
- `src/item/MapPickupSystem.ts`: grants configured map pickups to active-team
  entities inside their rectangular regions and preserves collected-turn state.
- `src/item/target.ts`: validates declarative self, entity, position, and zone
  targets against ownership, activity, range, and world bounds.
- `src/item/resolvedTarget.ts`: version-one detached entity/position targets for
  scheduled item Effects; zone targets are explicitly unsupported.
- `src/item/triggerDefinitions.ts`: version-one JSON-safe named TriggerDefinition
  catalog for validated core Effect/MultiEffect payloads; it is separate from
  Effect IDs.
- `src/item/officialItems.ts`: built-in declarative item catalog and Anker,
  Durchlässigkeit, Magnet, Falltür, Power-Dash, Verzögerte-Mine, Mini-Wall, Freeze-Shot, and Switch behavior using the validated item/effect pipeline. Freeze-Shot lowers to a generic turn-scoped temporal modifier containing the existing `movement.scale-speed` command; Mini-Wall lowers to a generic timed canonical rectangle lifecycle and retains expired structures as dormant entries.
  Power-Dash lowers `modifyForce` into the generic entity-owned
  `pendingActionModifiers` contract and is consumed once at the accepted-shot
  force boundary; Anker uses the same force operation with a two-turn lifetime
  in the same pending-action contract. Vodka-Zero lowers `aimVariance` into the
  generic `aim.random-offset` operation with canonical seeded state and one
  accepted-shot consumption at that same boundary; its legacy executable
  helper is historical compatibility only.
  Jägermeister-Elixier lowers `selectionLock` into the generic
  `actorEligibilityConstraints` plus separate turn-counted lifetime state;
  actor eligibility is enforced below UI by the shared Handler boundary and
  target eligibility remains independent. Its legacy executable helper is
  historical compatibility only.
  It also owns the Wunderkiste (Mystery Box) reward logic: `resolveMysteryBoxReward`
  picks a specific or seeded candidate-pool reward and rejects empty pools,
  unknown IDs, and recursive mystery-box rewards unless explicitly enabled;
  `grantMysteryBoxReward` adds exactly one capped reward use; `deriveMysteryBoxSeed`
  derives the deterministic seed from snapshot-stable state (actor, turn, team,
  and the seeded-draw seed or game-id hash), so restore and replay reproduce
  the same reward.
- `src/effects/ghostMode.ts`: historical Ghost Mode decoder/helper. Current
  Durchlässigkeit lowers to the generic `collisionFilters` plus separate
  turn-counted `collisionFilterLifetimes` state; `PhysicsSystem` filters the
  excluded `entity` and `structure` relations before resolution and collision
  entry dispatch. Boundary elimination remains independent.
- `src/effects/magnet.ts`: serializable attraction/repulsion effect with range
  and deterministic vector behavior.
  The declarative official-item path is active for
  validation and inventory tests, and `GameHandler.useItem()` resolves ordinary
  effects through the public KORE item-runtime boundary, persisting installed
   effect state in player snapshots. Generic temporal modifiers are persisted
   separately on player snapshots and applied once to an accepted movement
   action; the mystery-box reward remains the special
  inventory-grant path.
- `GameHandler` owns generic timed structure lifecycles: accepted structure
  templates create stable canonical structures, and expiry disables physics and
  drawing while retaining the structure in snapshots.
- `GameHandler` is the authoritative owner of deferred Engine-effect tick
  advancement. Due records emit transient `schedule.due` activations and
  execute through the shared predefined dispatcher; completed records are
  removed from canonical deferred state.
- `GameHandler` is also the authoritative owner of due `spawnTrigger` turn
  schedules; named definitions are loaded from `GameSettings.triggerDefinitions`
  and execute only against persisted entity targets.

### AI drivers

- `src/ai/aiEmitter.ts`: `AiTurnEmitter` executes a producer decision against
  a target emitter and filters wrong-team/dead actors through the pure
  `src/input/validate.ts` boundary (it must not import server modules, or the
  browser bundle would pull in `bun:sqlite`).
- `src/ai/easyAi.ts`, `mediumAi.ts`, and `hardAi.ts`: deterministic
  shot-only producers; `HardAi` samples bounded simulations
  (`decisionLimits`) and resolves equal-scoring candidates through its seed
  (seeded tie-break plus a rotated fallback angle grid), keeping killing
  moves preferred and non-killing ties aimed at an enemy, so every battle
  seed plays a different game while matches keep terminating. Hard AI passes
  its explicit 300-tick speculative horizon without changing the authoritative
  1,200-tick simulation default.
- `src/ai/types.ts`: `AiSettings` (`difficulty`, `seed`, `team`,
  `decisionLimits`) and `validateAiSettings`.
- `src/ai/worker/`: production browser Worker protocol, host lifecycle,
  deterministic compute, provenance validation, responsiveness metrics, and
  synchronous fallback boundary. Its explicit `starting`/`ready`/`failed`
  lifecycle queues healthy startup requests asynchronously; only failed or
  unavailable browser Workers use synchronous fallback. It restores canonical
  snapshots and returns AI intent only; browser integration is qualified for
  local AI scenes.
- `src/ai/AiBattleSystem.ts`: autonomous KI-vs-KI driver; an `ISystem` that
  skips the item phase, submits one legal shot per physics phase through
  `AiTurnEmitter`, and implements the passive `IMouse` contract so the result
  overlay can wrap it without accepting human input.

### Physics, structures, and systems

- `src/physics/physics.ts`: vector and physics contracts plus numeric `SHAPE`
  values (`CIRCLE`, `LINE`, `RECTANGLE`).
- `src/physics/defaultPhysics.ts`: vector operations, friction, impulse,
  stop prediction, collision detection, and collision response.
- `src/structures/types.ts`: structure contracts and exports.
- `src/structures/fullStructure.ts`: settings-to-runtime structure adapter.
- `src/structures/structureCircle.ts`, `structureRectangle.ts`, and
  `structureLine.ts`: concrete geometry. Line support is incomplete.
- Canonical structures carry stable IDs plus independent serialized
  `physicsEnabled` and `drawingEnabled` participation flags. Dormant structures
  remain in the canonical collection and can be positioned and reactivated by
  generic structure-targeted Effects; no Item-specific runtime structure-spawn
  system is used for Falltür. Timed canonical structure lifecycles may create
  stable structures through the generic lifecycle host. Historical geometry-derived IDs are assigned only by
  `src/migrations/structures.ts`; runtime `FullStructure` construction requires
  the persisted ID.
  Relative current Engine collision commands are stored separately as validated
  `collisionCommands` bindings; `GameHandler` resolves the colliding entity and
  routes them through the shared predefined dispatcher after physics resolution.
- `src/structures/DeadlyObstacleCircle.ts` and `DebuggerStructure.ts`: special
  or debug structures.
- `src/systems/types.ts`: `IGameContext`, `ISystem`, playback, and simulator
  contracts.
- `src/systems/MovementSystem.ts`: trusted pre-entity movement-effect
  interpreter using typed movement state.
- `src/systems/CounterSystem.ts`: trusted deterministic interpreter for generic
  numeric counter mutations; it mutates canonical context state but owns no
  persistent counter values or feature-specific meaning.
- `src/systems/NumericSystem.ts`: trusted interpreter for typed entity-owned
  numeric mutations. It derives threshold crossings from previous/current
  values and returns relative follow-up Effects through the shared dispatcher;
  it owns no numeric values or threshold configuration.
- `src/systems/predefinedEffectDispatcher.ts`: trusted predefined-System host;
  resolves stable counter/entity targets and routes each current Engine Effect
  to exactly one installed interpreter. It does not load executable content.
- `src/systems/PhysicsSystem.ts`: entity/entity and entity/structure collision
  iteration; friction remains an entity effect and position integration for
  collisions remains in this system's CCD solver.
- `src/systems/UiSystem.ts`: converts mouse drag into actor, angle, and power;
  only permits selection by the active team.
- `src/systems/Emitter.ts`: sends completed input through an `IInputEmitter`.
- `src/systems/PlayBackSystem.ts`: counts simulated frames and hard-syncs the
  final position and velocity.
- `src/systems/GameStateManager.ts`: incomplete state transitions.
- `src/systems/TurnSystem.ts`: client turn-state mapping for controlled teams.
- `src/systems/RoundSystem.ts`, `WinningSystem.ts`, `BoundarySystem.ts`,
  `EffectSystem.ts`, `Simulator.ts`, and related helpers: partial, placeholder,
  or archival implementations. Verify each before relying on it.

### Settings, rendering, menus, and assets

- `src/settings/settings.ts`: canonical `GameSettings`, friction presets,
  default teams/entities, active settings object, and grid arrangement.
- `src/engine/sdk/index.ts`: generic, KORE-free `engine` SDK entry for
  JSON-safe worlds/entities/structures/effects and deterministic framework
  metadata selection. It must not import KORE/game domains or runtime adapters.
- `src/engine/sdk/trigger.ts`: generic version-one detached tick and
  collision-entry trigger-event contracts with strict payload validation.
- `src/engine/contracts/counterState.ts` and
  `src/engine/sdk/counterCapability.ts`: generic version-one world-owned
  numeric CounterState plus typed `counter.set`, `counter.add`, and
  `counter.reset` commands. Counter IDs are stable targets; score, kills,
  coins, and other meanings remain content-layer semantics.
- `src/engine/contracts/numericState.ts` and
  `src/engine/sdk/numericCapability.ts`: generic version-one entity-owned
  numeric targets with declarative threshold crossings and typed
  `numeric.set`, `numeric.add`, and empty-payload `numeric.reset` commands.
  Reset values belong to canonical per-state bindings and are never carried
  in reset Effect payloads.
- `src/engine/ui-sdk/index.ts`: generic `ui` SDK built on the Engine SDK. Its
  menu runtime has explicit `tick(input, dt)` and `draw(renderer)` calls, owns
  no browser loop/listeners, and must not import KORE/game or browser domains.
- `src/engine/audio-sdk/index.ts`: generic `audio` SDK built on the Engine SDK.
  It owns JSON-safe semantic commands, narrow emitter capabilities,
  deterministic aggregation, persistent intent, framework metadata, and an
  output port; it must not import KORE, UI, browser, or audio-device APIs.
- `src/engine/presentation-sdk/index.ts`: generic `presentation` SDK for
  versioned JSON-safe animation tracks, semantic event ordering, priority,
  interruption/cancellation, deterministic tick projection, and visual-only
  runtime restoration. It must not import KORE, UI, browser, or device APIs.
- `src/kore/sdk/index.ts`: KORE `kore` SDK composed from the Engine SDK for
  validated engine-importable `GameSettings` JSON maps, serializable teams,
  spawns, KORE effects/defaults, and KORE handler composition.
- `src/content/package.ts`: version-one JSON content package schema, canonical
  hashing, detached loading, dependency/reference validation, and security
  rejection for maps, items, modes, UI, audio, and presentation declarations.
- `src/content/qualification.ts`: Milestones 41-48 content inventory, explicit
  pass/skip/blocked qualification matrix, and shared deterministic content
  fingerprint/action-trace helpers.
- `src/kore/audio.ts`: KORE semantic sound IDs, bus presets, and the optional
  browser asset manifest. `src/audio/BrowserAudioOutput.ts` is the browser-only
  output-port adapter; `src/menu/AudioManager.ts` owns media resources and
  autoplay unlocking, never game entities.
- `src/kore/gameplayFeedback.ts`: authoritative semantic gameplay feedback trace
  plus renderer-independent presentation and audio adapters; its history is
  visual/output state and is intentionally outside `EngineSettings`.
- `src/settings/iceMap.ts`: active map geometry, background, spawn regions, and
  structure effects.
- `src/environment/environmental.ts` and `src/systems/EnvironmentalSystem.ts`:
  versioned deterministic timed hazards, triggered zones, force fields, moving
  structures, and environmental cycles with snapshot-safe lifecycle state;
  activation transitions use bounded typed trigger events.
- `src/settings/cueClashMap.ts`, `frostbiteArenaMap.ts`, and
  `magmaCradleMap.ts`: scalable validated canonical map factories with world
  sizes independent of render dimensions. Magma Cradle uses loaded force and
  kill-zone collision hazards.
- `src/ui/Background.ts` and `CustomDrawableBackground.ts`: backgrounds.
- `src/scenes/matchPipeline.ts`: the single offline-match pipeline. It accepts
  validated content packages for local and AI test launches, converting the
  package's first map through `loadMapDocument()` and carrying its items and
  mode into the canonical match settings.
  `createMatchHandler` builds the canonical match for every mode (`hotseat`,
  `human-vs-ai`, `ai-battle`), installs the `WinningSystem` and the `GameEmitter`
  recorder (hotseat seeds `12345` for legacy reproducibility; AI modes draw a
  random seed or accept one), and applies the only mode-specific header: the
  versus mode sets `myTeam: [0]`, `allTeams: ["Human", "<difficulty> KI"]`, and
  `settings.ai`. Hotseat/versus add `UiSystem` + `EmitterSystem`; versus also
  adds `AiOpponentSystem`; the battle adds `AiBattleSystem` as the passive mouse
  handler only.
- `src/scenes/gameplayHud.ts`: shared `installGameplayHud(handler, actions)`
  installer around the SDK-authored `KoreGameHudSurface` used by player-facing
  gameplay scenes (local, online, standalone). It wires `ItemPhaseUI` from the
  `EmitterSystem`, default offline Pause/Resume/Rematch actions, and refreshes
  the result overlay projection on both the ticker and draw paths; the local
  pause command freezes transient handler ticks. Autonomous KI-vs-KI battles
  intentionally keep the HUD disabled during simulation and retain their
  passive AI input handler; the result controls are installed only after the
  battle reaches `Game_over`.
- `src/scenes/LocalMatchSceneRouter.ts`: menu -> local-match scene boundary
  without retaining stale handlers. The menu switches from its landing artwork
  to a passive autonomous KI-vs-KI preview rendered behind the SDK menu once
  the main menu is active. `createLocalGameplayHandler`,
  `createHumanVsAiHandler`, and `createAiBattleHandler` delegate to
  `createMatchHandler`; `startScene` installs `installGameplayHud` for player
  matches and leaves the KI-vs-KI engine HUD-free, while installing the
  offline match report; battle rematches re-draw the battle seed through a fresh
  scene (injectable `battleSeedSource`, exposed as `getBattleSeed()`), and the
  menu exit releases the local audio source before creating the fresh menu.
- `src/net/offlineMatchReport.ts`: browser-side `installOfflineMatchReport`
  (fires exactly once per finished match on the draw path, re-arms after a
  rematch), `collectOfflineMatchRecord`, and `reportOfflineMatch` (same-origin
  POST, never throws). The produced `OfflineMatchRecordPayload` carries the
   mode header, map id, recorder seed, optional difficulty, players, result, and
   the validated replay document.
- `src/net/performanceReport.ts`: browser-side aggregation and best-effort
  upload of completed online-match Handler performance logs. It stores no raw
  log buffer and never affects match or replay completion.
- `src/kore/ui/mainMenu.ts`: authoritative SDK-authored main-menu composition.
  Its `.build()` result contains every production menu screen, element, action,
  UI framework, and persistent menu-audio intent. `menuVocabulary.ts` owns its
  enum-backed KORE identifiers, commands, routes, styles, and parser;
  `KoreMainMenuSurface.ts` reconstructs that result as the KORE renderer/input/
  audio adapter. The surface owns the mod-import flow: it forwards keyboard
  input into the import text input, reads the clipboard through the injected
  `onReadModClipboard` callback, opens the host file picker through
  `onImportModFile`, validates JSON through the `src/mods/` pipeline, renders
  the summary/error into the result screen, and emits launch callbacks with the
  validated package. Do not add parallel pages, manual hitboxes, or browser
  resources to the composition.
- `src/kore/ui/gameHud.ts` and `KoreGameHudSurface.ts`: authoritative
  SDK-authored gameplay HUD composition and KORE projection/input/audio adapter.
  `hudCommands.ts` owns the enum-backed KORE HUD command vocabulary and
  `hudVocabulary.ts` owns its enum-backed identifiers/styles/labels;
  `gameHudProjection.ts` owns the detached gameplay projection, including
  active-player dots and pull-arrow world geometry. Generic UI
  settings still serialize ordinary strings, but KORE must author and parse its
  vocabulary exclusively through these enums. The local pause command freezes
  transient handler ticks; online pause controls are hidden because the server
  protocol has no production pause surface. Online item-phase skipping is
  authoritative through the network phase-change protocol. Do not add
  manual HUD hitboxes or direct `AudioManager` calls to
  gameplay scenes.
- `src/ui/mapbuilder.ts` and `src/ui/types.ts`: UI/map helper contracts.
- The SDK main menu offers "1 vs KI" (world rect `(30..140, 342..400)`),
  "KI vs KI" `(156..266, 342..400)`, "Play Online" `(282..392, 342..400)`,
  "Play Local Game" `(408..518, 342..400)`, "Choose Map"
  `(534..644, 342..400)`, and "Mods" `(660..770, 342..400)` in a centered
  bottom row with a 50px bottom margin.
  Its KORE composition generates browser-available
  catalog-map screens and filters battle screens to `battleAvailable` maps.
- `src/menu/AudioManager.ts`: single browser media owner. It resolves KORE
  sound IDs, manages media elements/volume/unlock/disposal, buffers persistent
  intent while locked, and retains playlist keyboard compatibility.
- `src/assetManager/assets/assetRegistry.ts`: generated numeric asset enum and
  path map, but tracked because source code imports it.
- `src/assetManager/loader.ts`: lazy browser image fetch/cache with a working
  `public/assets/json/` fallback path.
- `scripts/createAssetPack.ts`: scans public images, rewrites the asset
  registry, and emits base64 JSON packs under `public/assets/json/` with
  proper MIME types.
- `scripts/listAssets.ts`: diagnostic tool that checks size and MIME type of
  generated JSON assets under `public/assets/json/`.
- `scripts/profileAiBattle.ts`: aggregate headless AI-vs-AI performance
  profiler for candidate counts, speculative/accepted ticks, physics checks,
  and branch setup attribution; it does not change gameplay semantics.
- `scripts/profileAiDecisionStability.ts`: single-seed experimental profiler
  that compares Hard AI candidate selections at multiple simulation horizons
  against the current 1,200-tick reference without changing production AI.
- `scripts/profileAiCandidateLimits.ts`: bounded multi-seed profiler comparing
  candidate-limit selected-action parity and speculative work against the
  current 30-candidate reference.
- `scripts/profileAiWorker.ts`: non-production worker parity and boundary
  profiler for canonical snapshot reconstruction, transfer overhead, and
  prepared Hard AI intent.
- `scripts/performanceBaseline.ts`: explicit committed-baseline checker and
  updater backed by the aggregate profiler. `test:performance` never updates
  baselines; only `performance:update` does.

### Networking and utilities

- `src/server/types.ts`: JSON wire protocol and packet types.
- `src/server/config.ts`: server-published online-play configuration; reads
  `KORE_BASE_URL` (default `https://lupricht.net/kore`), derives the matching
  WebSocket URL, and serves the `/config` JSON contract used by the browser
  "Play Online" action.
- `src/server/dashboard.ts`: exact authenticated operator dashboard routes for
  aggregate lifecycle/player metrics plus durable map usage/count/percentage
  and most-played-map metrics; an unset or short
  `KORE_DASHBOARD_OPERATOR_SECRET` disables the routes. Authenticated
  `/operator/replays` lists every persisted replay and filters by exact match
  ID; `/operator/replays/<id>` downloads that deterministic replay document.
  Every completed match automatically receives an unbroadcast replay token; the
  archive exposes a `View replay` link only to authenticated operators. These
  operator-only replay routes may expose match IDs and settings, while public
  replay-share routes remain separately redacted. An operator view of an active
  match creates an unbroadcast opaque token containing only its current replay
  document, so unfinished matches can be replayed without public listing.
  `GET /operator/dashboard?format=json` returns the same complete aggregate
  dashboard payload as JSON; `/operator/dashboard/metrics` remains its JSON
  metrics alias. `GET /operator/login` serves a minimal password form and
  `POST /operator/login` accepts the operator secret and issues a signed,
  HttpOnly, Secure, SameSite=Strict eight-hour cookie accepted by the dashboard
  routes; `POST /operator/logout` expires it. Authenticated `GET /operator/db`
  downloads a consistent SQLite backup and is never available through public
  static-file routing.
- `src/server/server.ts`: login helpers.
- `src/server/db.ts`: explicit SQLite game store. It gzip-compresses complete
	`EngineSettings` snapshots plus immutable replay-origin settings/actions,
	maintains player-to-game membership rows, and
	migrates versioned lifecycle rows (`resident`, `paused`, `sleeping`, or
	`completed`) for durable aggregate match metrics. It also stores immutable
	UUID-keyed declarative map revisions with canonical content hashes and
	draft/approved/retired lifecycle state; map documents are always structurally
	validated and never updated in place. It stores completed offline/KI match
	records in an `offline_matches` table (`storeOfflineMatch`/`listOfflineMatches`
	without the replay payload).
- `src/server/offlineMatchContract.ts`: `OfflineMatchReport` type plus
  `validateOfflineMatchReport` for untrusted browser uploads (validated mode,
  safe-int seed, non-empty players, result, and replay document with a pristine
  origin).
- `src/server/offlineMatches.ts`: `serveOfflineMatchReport` route handler for
  `/offline-matches` (POST only, 2 MB body cap, 400 on malformed records).
- `src/server/performanceReports.ts`: game-member route handler for
  `/api/games/<gameId>/performance`; it accepts only completed games and stores
  idempotent match and per-turn performance summaries without replay state.
- `src/server/mapRepository.ts`: server-only approved-map lookup and canonical
  `MapDocument` -> `GameSettings` conversion boundary. It rejects draft and
  retired revisions for new matches while preserving them in storage. Its
  explicit revisioned cache refresh affects only future map lookups.
- `src/server/gameRegistry.ts`: authoritative match cache, turn ownership,
  input checks, simulation commits, rule progression, lifecycle-gated paused/
  completed actions, persistence, metric aggregation, and lazy SQLite
  restoration. `now` metrics are explicitly scoped to this process's cache.
- `src/server/runtime.ts`: testable WebSocket protocol runtime, login binding,
  matchmaking, input dispatch, and broadcasts. When configured with a
  `MapRepository`, matchmaking accepts only approved database map UUIDs and
  expands them server-side before match construction.
- `src/emitter/EngineEmitter.ts`: local hotseat input path; simulates, plays,
  advances its data-defined rule state, and then advances the active team.
- `src/emitter/NetworkEmitter.ts`: sends shot requests and applies
  authoritative `TURN` playback, `ITEM_USED` inventory snapshots, and active-team updates.
- `src/emitter/InputEmitter.ts` and `ObjectEmitter.ts`:
  emitter composition and test capture.
- `src/utils/net.ts`: unguarded JSON wrap/unwrap.
- `src/utils/onlineConfig.ts`: browser-side online-play config; fetches the
  server's `/config` advertisement, falls back to the page origin and then to
  the built-in default deployment, and builds the `skipmenu=1&url=...` join URL
  used by the menu's "Play Online" action.
- `src/utils/random.ts`: deterministic pseudo-random source for replayable
  gameplay decisions.
- `src/migrations/effects.ts` and `src/migrations/structures.ts`: explicit
  historical-input normalization boundaries. Runtime Effect validation accepts
  only current schema-versioned Effects, and runtime structure construction
  requires persisted canonical IDs.
- `src/utils/id.ts`: `localStorage` user/game IDs; not used by current startup.
- `src/utils/ErrorHandling.ts`: error utility.
- `src/utils/log.ts`: commented logger prototype.

Runtime timing and lifecycle observations belong in the typed, ephemeral
`GameHandler` runtime log buffer (`handler.log()` / `handler.getLogs()`). The
handler exposes the shared `LoggerType` enum as `handler.LoggerType` for
console filtering; `getLogs()` accepts one category or an array of categories.
They
must never be added to `EngineSettings`, deterministic fingerprints, replay
documents, or gameplay decisions. Durations use the monotonic runtime clock;
browser frame observations are emitted as bounded aggregate windows.
The initial event taxonomy uses `domain.event` names such as
`input.accepted`, `turn.simulation.completed`, `turn.playback.completed`,
`turnPacket.created`, `ai.decision.completed`, and
`turn.simulation.max-ticks`, `performance.frame-window`, `ai.worker.requested`, and
`ai.worker.completed`. Performance filtering includes `performance.*`,
`turn.*`, and `ai.*` observations, so Worker and turn timing are available
through `handler.getLogs(handler.LoggerType.Performance)`. Consumers inspect a
detached `getLogs()` result; there is no remote sink.
Physics settlement uses the same `!entity.isDead() && entity.physicsEnabled()`
participation semantics as `PhysicsSystem` ticking. Inactive/dead entities may
retain stale physical fields, but those fields must not keep a turn alive.
`turn.simulation.long-running` is an observational warning; the
`turn.simulation.max-ticks` safety-cap event is a regression signal in normal
qualification scenarios, not a normal completion mode.
- `src/types/global.d.ts`: browser globals including `window.game`.
- `src/i18n/language.ts`: typed JSON language loader. It always loads the
  complete `en_en` catalog first and overlays the selected language, so
  missing translations fall back to English. Production UI language is
  selected with `?lang=en_en` or `?lang=de_de`.
- `src/kore/ui/statusSurface.ts`, `replayViewerSurface.ts`, and
  `shareSurface.ts`: engine-rendered production status, replay, and share
  overlays. They do not create HTML UI elements.

## Toolchain And Setup

The active toolchain is Bun, ESM, TypeScript 5.9, p5.js, and Playwright
(headless Chromium for real-browser E2E tests). Install with:

```sh
bun install --frozen-lockfile
bunx playwright install chromium   # once per machine for browser E2E tests
```

Useful commands:

```sh
bun run test           # alias for the explicit fast lane (currently ~11s)
bun test               # raw all Bun-discovered tests; browser E2E runs under the Playwright runner instead
bun run test:unit      # pure contracts and deterministic component tests
bun run test:integration # owner/interpreter, authority, persistence, replay, and server boundaries
bun run test:qualification # active complete Engine/Item qualification; blocked evidence has a separate profile
bun run test:qualification:blocked # explicit known blocked/candidate qualification evidence
bun run test:e2e       # full Playwright browser lane
bun run test:soak      # deterministic default AI/physics stability profile
bun run test:release   # typecheck, build, fast, qualification, replay, browser smoke, examples, desktop
bun run test:fuzz      # default 25-match deterministic AI-vs-AI smoke fuzz run
bun run test:fuzz:rc   # 1000-match release-candidate fuzz run (~35s)
bun run test:fuzz:soak # 5000-match soak fuzz run (~3 min)
npx tsc --noEmit       # strict check of src/**/* without changing dist
bun run build          # compile src/**/* to dist; does not clean stale files
bun run test:gameplay-matrix     # Section 15 deterministic content matrix
bun run test:gameplay-tournament # Section 15 mirrored fairness tournament
bun run test:browser:smoke  # Section 16 startup/menu browser smoke (playwright runner; builds dist, manages the server)
bun run test:browser:ui-debug # Generic UI SDK browser debug-sandbox E2E
bun run test:browser:audio # Generic audio aggregation browser E2E
bun run test:browser:menu-sdk # SDK-authored production main-menu browser E2E
bun run test:browser:hud # SDK-authored gameplay HUD browser E2E
bun run test:browser:full   # Section 16/17.8 browser gameplay verification (playwright runner, all tests/browser specs)
bun run test:browser        # alias for test:browser:full
bun run sdk:release-gate    # final SDK-only source, example, qualification, browser, and desktop gate
bun run content:release-gate # Milestone 50 aggregate content gate; stops on technical failure and preserves human blockers
npx playwright test         # direct node-based runner; E2E_WORKERS overrides the default worker count
bun run test:maps           # Section 17 dev smoke map matrix run
bun run test:maps:matrix    # Section 17 full release map matrix comparison
bun run start               # run Bun HTTP/WebSocket server
bun run dev            # server plus TypeScript watch compiler
bun run watch:ts       # compile src continuously
bun run serve          # live-server only; no WebSocket backend
bun run createAssets   # intentionally regenerate registry and asset packs
```

There is no lint or formatting script. CI runs `bun install --frozen-lockfile`,
`bun run test:fast`, map verification, and a separate browser job; it targets
only the `main` branch. `tsconfig.json` includes only `src/**/*`; root `server.ts`, tests,
scripts, and `src-website/` are not typechecked by `npx tsc --noEmit`.

The root `.env` currently sets `PORT=4001` and
`KORE_BASE_URL=https://lupricht.net/kore/`; the server fallback is 3000.

Section 15 gameplay release qualification is recorded in
`docs/gameplay-balance-report.md` and `docs/release-verification.md`, with
`tests/gameplay_release_gate.test.ts` as the evidence gate. The current final
status is **BLOCKED / NOT QUALIFIED** because no external human playtest session
has been completed; automated evidence does not substitute for human evidence.

Section 17 map release qualification is recorded in
`docs/map-qualification-report.md` and `docs/release-verification.md`, with
`tests/map_release_gate.test.ts` as the evidence gate. Map-level human qualification remains pending (`PENDING`) while technical and browser qualifications pass.

Milestone 49 content cross-system qualification is recorded in
`docs/content-qualification-report.md` and
`tests/content_cross_system_qualification.test.ts`. It retains explicit
technical skips and human/platform blockers; Milestone 50 remains separate.

Milestone 50 SDK-authored content release verification is recorded in
`docs/sdk-content-release-verification.md`, with the aggregate command in
`scripts/contentReleaseGate.ts` and the focused evidence gate in
`tests/sdk_content_release_gate.test.ts`. The technical command is fail-fast;
human gameplay evidence remains `BLOCKED` and unverified platform evidence
remains `PENDING`.

## Browser Workflow

The browser always runs generated `dist/main.js`, not `src/main.ts` directly.
After source changes, run `bun run build` or use `bun run dev`. Because `tsc`
does not clean `dist`, remove stale output only when explicitly safe and never
as part of an unrelated change.

Browser failures leave bounded, git-ignored evidence under
`.browser-diagnostics/` (screenshot, console, page errors, context, and an
interaction log; see `tests/browser/browserDiagnostics.ts`).

Browser E2E runs headless by default (the CI release gate). Set
`BROWSER_HEADED=1` for a documented local headed/debug mode; headed execution
is never the release gate. `test:browser:smoke` covers startup/menu, and
`test:browser:full` covers the complete local browser match and the
Section 17.8 map-catalog E2E (every browser-available map opens through the
production menu, renders its structures/hazards, resolves one legal pointer
action, and returns to the menu); both build the generated bundle and manage
the Bun server lifecycle through the harness. Browser E2E is intentionally
excluded from `test:fast` because its server/Chromium lifecycle runs in its
dedicated CI job.

The browser specs run under the node-based `@playwright/test` runner
(`playwright test` with `playwright.config.ts` in the repo root), not under
the Bun test runner: the Bun runtime wedges Playwright protocol calls after
~2-3 minutes of continuous browser activity per process, which made the long
sequential runs hang intermittently (verified experimentally; the identical
workload completes cleanly under node). The specs themselves still drive
everything through `tests/browser/browserHarness.ts`, which builds the
bundle, spawns the Bun server, and launches Chromium without fixture pages;
every page protocol call is bounded so a dead renderer fails fast. Files in
`tests/browser` are therefore no longer discovered by `bun test`; the
`test:browser:*` package scripts keep their names and remain the CI entry
points (`bun run` wraps the `playwright test` invocation). SQLite-backed
fixture preparation that needs `bun:sqlite` runs through the
`tests/browser/prepare_replay_fixture.ts` helper (`runBunScript` in the
harness).

The default URL opens the menu. Local gameplay is selected with a non-empty
`skipmenu` query parameter, for example:

```text
http://localhost:4001/?skipmenu=1
```

`skipmenu` is truthy only for the values `1` and `true` in `src/main.ts`.
`?debug=ui` opens the standalone generic UI SDK sandbox instead of normal
menu/game startup; `?debugui=1` remains its diagnostic alias. Its browser host
is intentionally outside `src/engine/ui-sdk/`.
`?lang=en_en` or `?lang=de_de` selects the production UI language; English is
the default and the fallback for missing selected-language entries. Production
loading, replay, share, menu, HUD, and gameplay labels are rendered through
the engine/UI surfaces rather than HTML overlays.
`url` selects the WebSocket server for network gameplay; `mapbuilder` is parsed
but currently unused. The main menu's "Play Online" button fetches the
server's `/config` advertisement (base URL from `KORE_BASE_URL`) and navigates
to `?skipmenu=1&url=<derived-ws-url>`; the manual `?url=` override still wins
when present.

The browser runtime is the vendored p5 file in `public/` (currently p5
1.11.x), while `package.json` declares p5 2.x and the typings are 1.7.x.
Account for this mismatch when changing rendering APIs.

## Runtime Flow

### Startup and systems

`GameHandlerBuilder.defaultSystems()` installs systems in this order:

1. `MovementSystem`
2. `NumericSystem`
3. `ParticipationSystem`
4. `TransformSystem`
5. `PlaybackSystem`
6. `PhysicsSystem`
7. `BoundarySystem`
8. `GameStateManager`

The local gameplay branch in `src/main.ts` adds `UiSystem` and `EmitterSystem`
through `createMatchHandler`, then installs input/drawing/result wiring with the
shared `installGameplayHud`; `defaultSystems()` remains
the sole registration point for physics and playback. The network branch waits
for the server `INIT` settings, then installs the same UI systems with
  `NetworkEmitter` through the same HUD installer (capability-limited: pause is
  hidden because the server protocol has no production pause surface; item-phase
  skipping uses the authoritative network phase-change protocol).

`GameHandlerBuilder.fromSettings()` installs the background, teams, players,
wrapped map structures, handler effects, items, and map friction. It restores
engine state, turn number, and active team when given `EngineSettings`.

### Per-frame update order

`GameHandler.tick()` executes:

1. Pre-tickers.
2. Handler-level always effects on every entity.
3. Registered systems' optional pre-entity ticks.
4. Every entity's `tick()`.
5. Systems in registration order.
6. Structure ticks.
7. Post-tickers.

`MovementSystem` delegates Always-triggered movement to `EffectMove` through
the typed movement-state boundary. `Player.tick()` retains the entity-local
friction `EffectPhysics` path. `PhysicsSystem` resolves collisions and zeros
very low speeds; despite its comments, it does not apply friction itself.

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
   ticks until static or its explicit max-tick budget; the default and
   authoritative path remain 1,200 frames, while Hard AI speculation passes
   300.
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
- `background`: color, numeric `AssetList` image, or HTTP(S)/same-origin image URL
- `friction: { friction, linearDrag, stopThreshold }`
- `drift`: finite `[0, 1]` per-tick, speed-preserving steering blend toward each
  player's rotation; it does not apply at or below the physics stop threshold
- `playerCount` and `figuresPerPlayer`: positive integer match-layout settings;
  they serialize with engine snapshots. `createDefaultGameSettings()` generates
  the two-sided ice-map layout from them.
- handler `effects`, `items`, teams, and player-count metadata

Database-derived settings additionally preserve `{ mapId, contentHash }` in
`mapReference`; the expanded geometry remains in the same snapshot so a retired
map revision can still restore an existing match deterministically.

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
`ServerRuntime` accepts `USE_ITEM` only through `GameRegistry`, which requires
the item phase, active-team ownership, valid targets, and available inventory;
accepted uses broadcast `ITEM_USED` with rule state and player snapshots.
Canonical map documents carry world size, friction, drift, geometry, spawn regions,
hazard references, and metadata. `loadMapDocument()` converts force and kill-zone
collision hazards into serializable runtime structure effects; other hazard types
remain unsupported.

`EngineSettings` adds game state, turn number, active team, serialized rule
state, match result, and runtime entity snapshots. Persisted game snapshots must
preserve all turn and rule-progress fields.
It also persists the complete world-owned `counters` collection; counter reads
use canonical state and never inspect Effect history or hidden system state.
It also carries sorted, versioned stable system settings plus explicit tick order;
the allowlisted system factory rejects unknown, duplicate, malformed, executable,
or unsupported-version system data during restoration.
`GameModeSettings` can carry an `ItemEconomySettings` contract for fixed
per-team loadouts, declared map pickups, deterministic seeded draw pools, and
an optional mystery-box reward configuration (`candidatePool` plus an explicit
`allowMysteryBoxReward` recursion flag); the selected optional mode is
preserved in engine snapshots.
Seeded item-draw state is also preserved in engine snapshots so reconnect and
replay restoration resume the configured deterministic draw pool.
`GameSettings.triggerDefinitions` carries validated named core Effect/MultiEffect
definitions for supported `spawnTrigger` schedules.
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

Committed performance baselines live in `performance/baselines.json` and are
checked with `bun run test:performance`. Do not update committed performance
baselines merely to make a failing performance test pass. A baseline increase
requires an explicit explanation of why the additional cost is intentional or
unavoidable. Prefer fixing regressions over moving the baseline.

For each commit-sized checklist task, run the named focused test file(s), nearby
subsystem coverage, and TypeScript validation:

```sh
npx tsc --noEmit
```

Run `bun run build` when browser/runtime code, exported contracts, or generated
browser output changes. Run task-specific browser, server, fuzz, benchmark, or
packaging commands when the checklist requires them.

Run the complete serial suite only for a chapter's final qualification, release
gate, or an explicitly requested repository-wide validation:

```sh
bun test
```

Do not use `bun test --parallel` or `bun test --changed` as a substitute for
the final qualification suite. Use `test.serial(...)` for tests that share a
process-global resource, mutate a common fixture, bind a fixed port, or require
ordered lifecycle transitions; keep independent tests parallel-safe.

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

### Section 11 Cross-System Validation Suite

`step-by-step.md` section 11 records the cross-system validation suite;
each of its nine tasks ships one focused test plus the checklist flip. The
suite proves deterministic engine snapshots (`handler_snapshot_isolation`,
`simulate_turn_isolation`, `parallel_engine_instances`), hard-AI decision
equality on restored handlers (`hard_ai_snapshot_validation`), replay
lifecycle determinism and strict replay document validation
(`ai_replay_lifecycle`), SQLite match restoration with identical rule state
and malformed-snapshot rejection (`persisted_match_continuation`), winning
evaluation composition and result-once semantics (`winning_lifecycle_validation`),
item-effect remaining-state serialization (`item_effect_snapshot_validation`),
and uniform invalid-input rejection across the emitter, AI, server, and replay
paths (`action_path_consistency`; `GameEmitter.sendShot` rejects through the
same `isValidInput` predicate the server and AI path use, before recording or
simulating). `tests/cross_system_validation_smoke.test.ts` references every
section 11 file. When adding a cross-system test, mirror these boundaries and
update the smoke file.

### Section 12 Defect Hardening And Release Qualification

`step-by-step.md` section 12 records release-candidate qualification after targeted
defect hardening, each task shipped as one atomic commit with focused tests:
match completion gating (`tests/match_completion_gate.test.ts`), the explicit
match status model (`tests/match_status_model.test.ts`), winner-state
unification (`tests/winner_state_unification.test.ts`), pure settings export
(`tests/settings_export_purity.test.ts`), replay rule-state orchestration
(`tests/replay_rule_state_orchestration.test.ts`), and the hardened effect
factory (`tests/effect_factory_roundtrip.test.ts`; `MetaEffect` rejects
unknown types and `EffectType.Multi` is a true ordered multi-effect). The
deterministic AI-vs-AI fuzz suite (`tests/ai_match_fuzz.test.ts` plus
`tests/support/aiMatchFuzz.ts`) derives all randomness from each match seed,
injects negative actions that must be rejected without mutating the match,
verifies the AI decision boundary, and checks replay/persistence/rematch per
match; `RC_GAME_COUNT` controls smoke (25), RC (1000), and soak (5000) runs
wired as `test:fuzz`, `test:fuzz:rc`, and `test:fuzz:soak` package scripts.
`tests/release_candidate_gate.test.ts` references the Section 12 evidence
files and the 24-point qualification record in `docs/release-verification.md`.
When adding a hardening or fuzz test, mirror these boundaries and update the
gate test.

### Section 13 Physics Solver Qualification

Section 13 defines and qualifies the collision contract: deterministic complete
depenetration, zero-distance and endpoint handling, bounded multi-contact and
CCD, energy/rest invariants, entry-only collision effects, and snapshot contact
continuity. `PhysicsSystem` serializes active lifecycle pairs only at completed
tick boundaries using canonical entity UUID/Structure ID keys; local iteration
indexes are not persisted identity. `tests/physics_qualification_gate.test.ts`
references the solver evidence; `test:physics-fuzz`, `test:physics-fuzz:rc`,
and `test:physics-fuzz:soak` run 100, 5,000, and 25,000 deterministic cases.

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
from SQLite. The database path is explicit `GAME_DB_PATH` or a default anchored
to `<server-root>/data/kore.db`, never the process working directory.
Completed-match replay shares are idempotent per game: either participant may
request the same public token and the runtime broadcasts it to both connected
participants. The requesting online HUD `Replay` action opens the read-only
viewer; `Share` exposes the same URL for copying.
The server advertises its public base URL through `/config`: `KORE_BASE_URL`
(default `https://lupricht.net/kore`) is read at startup, the matching WebSocket
URL is derived, and both are served as a never-cached JSON contract. The
browser "Play Online" action reads that contract to build its join URL.

Do not trust values from a `SHOOT` packet. `GameRegistry` must continue to
validate finite angle/power ranges, actor ownership/activity, game membership,
and turn ownership before resolving a turn. Keep the registry/runtime testable
by injecting `new GameDatabase(":memory:")`.
Clients likewise cannot create an authoritative match from a raw settings or map
payload: matchmaking accepts a server-approved map ID and expands it through
`MapRepository`.

Be careful when running `bun run start`:

- The static handler serves `index.html`, `/sw.js` (from `public/sw.js` for the
  root-scope offline shell), `public/`, `dist/`, and the `/config` JSON contract;
  continue to keep secrets out of this repository and do not broaden that
  allowlist casually.
- The production server writes `<server-root>/data/kore.db` by default. `*.db`
  is ignored; do not commit database files. Set `GAME_DB_PATH` for another
  durable path.

`window.game.handler` is a getter over the active scene handler (menu -> match
-> rematch -> menu), so the debug surface always reflects the authoritative
handler. `window.game.mapId` exposes the stable catalog map ID of the active
local match (null in the menu). `window.game` also exposes the `logs` array and
the `AudioManager`.

## Known High-Impact Limitations

Verify these before building on the affected code; they are current behavior,
not desired design:

- `Player.setMass()` clamps values above one and rejects non-finite or
  non-positive mass.
- Positive KORE `numeric.add` HP values reduce HP, and HP at or below zero disables a
  player's physics and drawing participation. Death circles use ordered
  `EffectType.Multi` Effects to set both flags false. Inactive players render
  as authoritative `OUT` markers but no longer tick, collide, accept selection,
  or resolve a turn; snapshots preserve the orthogonal participation flags.
  Match-end input is
  blocked, but winning evaluation is not yet integrated into round progression.
- Round effects are stored but not meaningfully executed. Circle and rectangle
  collision effects execute, including converted editor push and kill zones.
- `EffectType.Multi` is a true ordered multi-effect that applies and serializes its children; `MetaEffect` rejects unknown effect types instead of silently substituting movement.
- Outer circle/rectangle containment is inferred from mixed structures; line
  segments are collision obstacles only. Leaving an inferred containment
  boundary kills a player; a last-team-standing evaluator exists but is not yet
  integrated into completed-match flow.
- Mouse tracking depends on a browser-created `defaultCanvas0` global.
- Gameplay release qualification is blocked pending an external two-match
  human session. Automated evidence retains blocked matrix configurations,
  hard-AI safety-limit/agency limitations, and some item lifecycle integrations
  (for example, persistent effect expiration and temporary-wall cleanup) still
  require gameplay qualification.
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
5. Run focused task/subsystem tests and `npx tsc --noEmit`; reserve `bun test`
   for the chapter-final qualification, release gate, or an explicit request.
6. If browser behavior changed, build and test the generated `dist/main.js`
   path, including `?skipmenu=1` when gameplay is required.
7. If server/editor/scripts changed, verify them separately because the main
   TypeScript project does not check them.
8. Report commands run, failures, generated files, and any known unverified
   behavior.
