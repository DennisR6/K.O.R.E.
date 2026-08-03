# Slipstrike Step-by-Step Execution Checklist

## How To Use This Checklist

- `[ ]` means planned and not started.
- `[v]` means actively being worked on. Keep exactly one task at this state.
- `[-]` means its stale at the moment and can safely be skipped
- `[x]` means complete, verified, and committed.
- Before starting a task, inspect `git status`, read the named code and tests,
  and preserve unrelated worktree changes.
- Keep each checkbox to one atomic commit. Prefer 10-50 changed lines and 1-3
  production files plus focused tests. Expand a task before implementation if
  that would break atomicity.
- Mark the task `[v]` before editing. After its focused tests pass, change it
  to `[x]` and include the checklist update in the same atomic commit as its
  code and tests. Verify the committed checklist state immediately afterward.
- Use conventional commit prefixes that describe the change: `feat:`, `fix:`,
  `refactor:`, `test:`, `docs:`, `build:`, or `chore:`.
- Run `bun test` and `npx tsc --noEmit` for source changes. Also run the
  relevant server, browser-build, package, or device checks named by the task.
- After every change, decide whether `AGENTS.md`, `TODO.md`, and this checklist
  still describe reality; update them in the same atomic commit when needed.
- Do not start dependent tasks until their prerequisites are `[x]`.
- A separate mod workshop is intentionally out of scope. Validated
  `game.handler.toSettings()` exports and server-shared settings are the mod
  sharing mechanism for this plan.

## 1. Baseline And Architecture

- [x] Reconcile every TODO checkbox with source and tests; record the real
  status and acceptance criteria in `TODO.md`. Commit: `docs: reconcile todo status`.
- [x] Add a focused requirements ledger linking TODO and GDD requirements to
  checklist sections and test coverage. Commit: `docs: add requirements ledger`.
- [x] Add a deterministic seeded random-number contract and unit tests for
  repeatable sequences. Expected scope: one utility and one test. Commit:
  `feat: add deterministic random source`.
- [x] Define serializable game-mode, rule-phase, and match-result contracts
  independent of `GameHandler`. Expected scope: new rule types and tests.
  Commit: `feat: define game rule contracts`.
- [x] Add a data-driven rule interpreter that advances rule phases without
  changing physics behavior. Expected scope: interpreter, rule types, tests.
  Commit: `feat: add rule phase interpreter`.
- [x] Route local turn progression through the rule interpreter while retaining
  the current active-team behavior. Expected scope: emitter, handler adapter,
  regression test. Commit: `refactor: use rules for local turns`.
- [x] Route authoritative server turn resolution through the rule interpreter
  and preserve existing sender validation. Expected scope: registry, runtime
  test, server protocol test. Commit: `refactor: use rules for server turns`.
- [x] Remove duplicated gameplay ownership from engine systems after rule
  interpreter coverage proves equivalence. Expected scope: obsolete rule path,
  exports, regression test. Commit: `refactor: isolate gameplay rules`.

## 2. Deterministic Physics And Arena Safety

- [x] Add snapshot-based tests for a single rotation/force impulse through the
  real map physics loop. Expected scope: physics test fixture and assertions.
  Commit: `test: cover deterministic shot simulation`.
- [x] Represent figure rotation and optional angular velocity in serializable
  player settings without breaking existing snapshots. Expected scope: player
  contract, serializer, round-trip test. Commit: `feat: serialize figure rotation`.
- [x] Derive shot direction from rotation through one shared vector helper and
  test cardinal directions. Expected scope: physics helper and test. Commit:
  `refactor: share rotation direction conversion`.
- [x] Add map-configured drift settings to the canonical settings contract and
  validate their finite ranges. Expected scope: settings types and test.
  Commit: `feat: define map drift settings`.
- [x] Apply deterministic drift steering during movement and add fixed-frame
  regression coverage. Expected scope: movement effect and test. Commit:
  `feat: apply map drift steering`.
- [x] Reject zero and negative player mass at the player settings boundary.
  Expected scope: player validation and test. Commit: `fix: validate player mass`.
- [x] Correct rectangle/rectangle collision dispatch and add separated,
  overlapping, and edge-contact tests. Expected scope: physics dispatch and
  test. Commit: `fix: correct rectangle collision dispatch`.
- [x] Implement line collision detection for circles and test each line normal
  direction. Expected scope: line physics helper and test. Commit:
  `feat: detect circle line collisions`.
- [x] Implement circle/line collision response and test deterministic bounce
  velocity. Expected scope: collision response and test. Commit:
  `feat: resolve circle line collisions`.
- [x] Honor `physicsEnabled` during collision iteration and test that disabled
  entities and structures do not alter velocity. Expected scope: system and
  test. Commit: `fix: respect physics enabled flags`.
- [x] Align circle drawing dimensions with collision dimensions and add a
  renderer-contract test where practical. Expected scope: structure drawing and
  test. Commit: `fix: align circle rendering and collision`.
- [x] Add a generic map-boundary containment API for circle, rectangle, and
  line arenas. Expected scope: structure contracts and geometry tests. Commit:
  `feat: add arena containment checks`.
- [x] Mark entities dead when they leave configured arena boundaries and test
  deterministic death timing. Expected scope: boundary system and test. Commit:
  `feat: eliminate out of bounds entities`.
- [x] Ensure dead entities are excluded from movement, collisions, selection,
  turn eligibility, and serialization round trips. Expected scope: entity
  manager or player path plus test. Commit: `fix: consistently exclude dead entities`.
- [x] Add a complete fixed-seed physics regression fixture containing movement,
  friction, drift, collision, and boundary death. Expected scope: one test
  fixture and assertions. Commit: `test: add full deterministic physics fixture`.

## 3. Match Rules And Round Lifecycle

- [x] Add a serializable settings field for player count and figures per player
  so 1 player with X figures versus 1 player with X figures is configurable.
  Expected scope: settings types and test. Commit: `feat: configure team figure counts`.
- [x] Generate default team/entity layouts from the configured figure counts
  rather than hard-coded map teams. Expected scope: settings builder and test.
  Commit: `feat: generate configured team layouts`.
- [x] Define the optional item-phase rule state and its allowed transitions.
  Expected scope: rule contract and state-machine test. Commit:
  `feat: add item phase state`.
- [x] Define required aim, charge, and push rule states and reject skipped
  transitions. Expected scope: rule interpreter and test. Commit:
  `feat: enforce shot phase transitions`.
- [x] Define the no-input physics phase and block input until playback and
  simulation settle. Expected scope: UI/system guard and test. Commit:
  `feat: lock input during physics phase`.
- [x] Persist and restore rule phase, active team, turn number, and pending
  per-turn data in engine snapshots. Expected scope: snapshot types and test.
  Commit: `feat: persist round rule state`.
- [x] Expose authoritative rule phase in `INIT` and `TURN` packets and apply it
  on clients. Expected scope: server types, emitter, protocol test. Commit:
  `feat: synchronize rule phase`.
- [x] Add a configurable last-man-standing win evaluator for teams with any
  configured number of figures. Expected scope: winning system and test.
  Commit: `feat: evaluate last man standing`.
- [x] Add a serializable match-complete result containing winner, reason, and
  final turn. Expected scope: rule contracts and test. Commit:
  `feat: serialize match results`.
- [x] Stop new turn input after a completed match and show a final-state UI
  indicator. Expected scope: UI and state test. Commit: `feat: block input after match end`.
- [x] Add a local rematch/reset action that rebuilds a match from its configured
  settings. Expected scope: menu or game controller and test. Commit:
  `feat: add local rematch flow`.
- [x] Add an authoritative rematch/reset request and broadcast its initialized
  state to connected clients. Expected scope: wire protocol, runtime, test.
  Commit: `feat: add network rematch flow`.

## 4. Data Contracts, Mods, And Maps

- [x] Add schema version fields to game, map, item, hazard, AI, and replay
  documents. Expected scope: type contracts and migration test. Commit:
  `feat: version serialized game documents`.
- [x] Define a strict game-settings validator that rejects malformed numeric,
  team, structure, and effect data. Expected scope: validator and test. Commit:
  `feat: validate game settings`.
- [x] Define a strict map schema with friction, drift, arena geometry, spawn
  regions, hazards, and metadata. Expected scope: map types and test. Commit:
  `feat: define map schema`.
- [x] Add a validated map loader that converts canonical map data into
  `GameSettings` structures. Expected scope: loader and test. Commit:
  `feat: load validated maps`.
- [x] Define a hazard registry contract and serialized hazard trigger shape.
  Expected scope: hazard types and registry test. Commit:
  `feat: define hazard registry`.
- [x] Implement the data-defined force hazard and test a fixed impulse at a
  configured trigger. Expected scope: hazard implementation and test. Commit:
  `feat: add force hazards`.
- [x] Implement the data-defined rotation hazard and test its serialized state
  change. Expected scope: hazard implementation and test. Commit:
  `feat: add rotation hazards`.
- [x] Implement the data-defined kill-zone hazard using shared death handling.
  Expected scope: hazard implementation and test. Commit: `feat: add kill zone hazards`.
- [x] Implement a data-defined slow-zone hazard and test friction or speed
  modification lifetime. Expected scope: hazard implementation and test.
  Commit: `feat: add slow zone hazards`.
- [x] Implement delayed hazard triggers with deterministic scheduling and
  snapshot restoration. Expected scope: scheduler and test. Commit:
  `feat: add delayed hazard triggers`.
- [x] Add the Cue Clash map as validated canonical map data and verify one
  simulated shot. Expected scope: map data and test. Commit: `feat: add cue clash map`.
- [x] Add the Frostbite Arena map with extreme drift and verify fixed-frame
  behavior. Expected scope: map data and test. Commit: `feat: add frostbite arena map`.
- [x] Add the Magma Cradle map with active hazard zones and verify eliminations.
  Expected scope: map data and test. Commit: `feat: add magma cradle map`.
- [x] Define an editor-export schema distinct from engine settings and validate
  imports before use. Expected scope: editor contract and test. Commit:
  `feat: validate editor map exports`.
- [x] Convert validated editor maps to canonical engine map settings and cover
  representative shapes, spawns, and hazards. Expected scope: converter and
  test. Commit: `feat: convert editor maps to engine settings`.
- [x] Replace unsafe editor JSON-to-DOM interpolation with safe DOM assignment
  for imported values. Expected scope: editor UI and browser test. Commit:
  `fix: safely render imported map data`.
- [x] Repair the editor's missing imports and undefined function references.
  Expected scope: one editor module and test. Commit: `fix: restore editor imports`.
- [x] Replace duplicate editor element IDs with unique identifiers and update
  their references. Expected scope: editor markup and one script. Commit:
  `fix: use unique editor element ids`.
- [x] Implement the editor temporary-save action with validated map data.
  Expected scope: editor save module and test. Commit: `feat: save temporary editor maps`.
- [x] Replace the editor's hard-coded preview address with configurable current
  origin behavior. Expected scope: preview module and test. Commit:
  `fix: configure editor preview address`.

## 5. Item Framework And Official Items

- [x] Define versioned item, inventory, pickup, target, duration, and use-limit
  schemas. Expected scope: item types and validation test. Commit:
  `feat: define item data schema`.
- [x] Add a strict item validator with an effect-type whitelist and no executable
  script fields. Expected scope: validator and rejection tests. Commit:
  `feat: validate declarative items`.
- [x] Add an item loader that registers built-in and local mod items through the
  same validation path. Expected scope: loader and test. Commit:
  `feat: load declarative items`.
- [x] Add per-mode item-economy settings supporting fixed loadouts, map pickups,
  and seeded random draws. Expected scope: settings contract and test. Commit:
  `feat: configure item economy`.
- [x] Implement fixed loadout initialization and use consumption. Expected
  scope: inventory system and test. Commit: `feat: initialize fixed item loadouts`.
- [x] Implement deterministic seeded item draws and serialize draw state for
  replay and reconnect. Expected scope: draw system and test. Commit:
  `feat: add deterministic item draws`.
- [x] Implement map item pickups and validate active-team ownership. Expected
  scope: pickup system and test. Commit: `feat: collect map item pickups`.
- [x] Implement item target validation for entity, position, and zone targets.
  Expected scope: target validator and test. Commit: `feat: validate item targets`.
- [x] Implement authoritative item-use packets and reject use outside the item
  phase or by the wrong team. Expected scope: server protocol and test. Commit:
  `feat: authorize item use`.
- [x] Implement local item-use emission and authoritative client state updates.
  Expected scope: emitter/UI adapter and test. Commit: `feat: synchronize item use`.
- [x] Add the serializable `modifyForce` effect primitive and test stacking.
  Expected scope: effect and test. Commit: `feat: add modify force effect`.
- [x] Add the serializable `modifyRotation` effect primitive and test angle
  normalization. Expected scope: effect and test. Commit: `feat: add modify rotation effect`.
- [x] Add the serializable `lockRotation` effect primitive and test expiration.
  Expected scope: effect and test. Commit: `feat: add lock rotation effect`.
- [x] Add the serializable `applyTorque` effect primitive and test deterministic
  angular updates. Expected scope: effect and test. Commit: `feat: add torque effect`.
- [x] Add the serializable `spawnTrigger` effect primitive and test snapshot
  restoration. Expected scope: effect and test. Commit: `feat: add spawn trigger effect`.
- [x] Add the serializable delayed-effect primitive and test fixed-tick timing.
  Expected scope: scheduler effect and test. Commit: `feat: add delayed effect`.
- [x] Add the serializable shield effect primitive and test damage/collision
  interaction. Expected scope: effect and test. Commit: `feat: add shield effect`.
- [x] Add the serializable freeze effect primitive and test movement reduction
  and expiration. Expected scope: effect and test. Commit: `feat: add freeze effect`.
- [x] Add a reusable teleport/swap effect primitive and test invalid target
  rejection. Expected scope: effect and test. Commit: `feat: add swap position effect`.
- [x] Add a reusable temporary-wall effect primitive and test structure cleanup.
  Expected scope: effect and test. Commit: `feat: add temporary wall effect`.
- [x] Add the Anker item data and behavior for configurable knockback reduction.
  Expected scope: item JSON and behavior test. Commit: `feat: add anker item`.
- [x] Add the Durchlaessigkeit item data and behavior for temporary ghost-mode
  collision filtering. Expected scope: item JSON and behavior test. Commit:
  `feat: add ghost mode item`.
- [x] Add the Magnet item data and behavior for configurable attraction or
  repulsion. Expected scope: item JSON and behavior test. Commit: `feat: add magnet item`.
- [x] Add the Falltuer item data and behavior that spawns a kill-zone trigger.
  Expected scope: item JSON and behavior test. Commit: `feat: add trapdoor item`.
- [x] Add the Power-Dash item data and behavior for configured force or friction
  modification. Expected scope: item JSON and behavior test. Commit:
  `feat: add power dash item`.
- [x] Add the Verzoegerte-Mine item data and behavior for delayed force
  explosion. Expected scope: item JSON and behavior test. Commit:
  `feat: add delayed mine item`.
- [x] Add the Mini-Wall item data and behavior for a temporary portable wall.
  Expected scope: item JSON and behavior test. Commit: `feat: add mini wall item`.
- [x] Add the Freeze-Shot item data and behavior for temporary slowing. Expected
  scope: item JSON and behavior test. Commit: `feat: add freeze shot item`.
- [x] Add the Switch item data and behavior for validated figure-position swaps.
  Expected scope: item JSON and behavior test. Commit: `feat: add switch item`.
- [x] Add the Jaegermeister-Elixier item data and behavior that prevents an
  opponent figure from being selected for its duration. Expected scope: item
  JSON and behavior test. Commit: `feat: add selection lock item`.
- [x] Add the Vodka-Zero item data and seeded deterministic aim variance.
  Expected scope: item JSON and replay test. Commit: `feat: add deterministic aim variance item`.
- [x] Add item stacking, conflict, cleanup, serialization, and replay regression
  tests for mixed effect combinations. Expected scope: focused integration test.
  Commit: `test: cover item effect interactions`.

## 6. Input, UI, And Accessibility

- [x] Define configurable action bindings for aim, charge, push, and item use.
  Expected scope: input contracts and test. Commit: `feat: define configurable actions`.
- [x] Separate aim rotation selection from power charging in the UI input model.
  Expected scope: UI system and test. Commit: `feat: separate aim and charge input`.
- [x] Add explicit item-phase UI with available items, valid targets, and skip
  behavior. Expected scope: UI system and browser test. Commit: `feat: add item phase interface`.
- [x] Add clear active-team, rule-phase, turn number, force, and selected-item
  indicators. Expected scope: drawing system and test. Commit: `feat: show match state indicators`.
- [x] **Task [6.3]: Controller Input Bindings**
  - **Goal:** Add controller stick/trigger bindings through the action abstraction.
  - **Target Files:** `src/input/controller.ts`, `src/input/actions.ts`
  - **Test File:** `tests/controller_input.test.ts`
  - **Allowed Context:** `src/input/actions.ts`, `src/engine/types.ts`
  - **Commit:** `feat: add controller input`
- [x] **Task [6.4]: Touch Input Bindings**
  - **Goal:** Add touch drag-and-hold bindings through the action abstraction.
  - **Target Files:** `src/input/touch.ts`, `src/systems/UiSystem.ts`
  - **Test File:** `tests/touch_input.test.ts`
  - **Allowed Context:** `src/input/actions.ts`, `src/systems/UiSystem.ts`
  - **Commit:** `feat: add touch input`
- [x] **Task [6.5]: Mobile Layout Adaptation**
  - **Goal:** Add responsive mobile layout rules with large touch targets and verify a small viewport browser path.
  - **Target Files:** `src/ui/layout.ts`, `src/main.ts`
  - **Test File:** `tests/mobile_layout.test.ts`
  - **Allowed Context:** `src/engine/RenderContext.ts`, `src/main.ts`
  - **Commit:** `feat: adapt interface for mobile`
- [x] **Task [6.6]: Desktop And Steam Deck Layout Scaling**
  - **Goal:** Add desktop and Steam Deck layout scaling for compact and large displays.
  - **Target Files:** `src/ui/layout.ts`, `src/engine/drawingEngine.ts`
  - **Test File:** `tests/scaling_layout.test.ts`
  - **Allowed Context:** `src/engine/RenderContext.ts`, `src/engine/drawingEngine.ts`
  - **Commit:** `feat: scale interface for desktop`
- [x] **Task [6.7]: Stabilize Canvas Input Handlers**
  - **Goal:** Fix p5 wheel handler binding and remove dependence on the browser-created `defaultCanvas0` global.
  - **Target Files:** `src/main.ts`, `src/systems/UiSystem.ts`
  - **Test File:** `tests/canvas_input.test.ts`
  - **Allowed Context:** `src/main.ts`, `src/systems/UiSystem.ts`
  - **Commit:** `fix: stabilize canvas input handlers`

## 7. AI And Play Modes

- [x] **Task [7.1]: Define AI Settings**
  - **Goal:** Define serializable AI configuration including seed, difficulty, and decision limits.
  - **Target Files:** `src/ai/types.ts`, `src/settings/settings.ts`
  - **Test File:** `tests/ai_settings.test.ts`
  - **Allowed Context:** `src/settings/settings.ts`, `src/engine/types.ts`
  - **Commit:** `feat: define ai settings`
- [x] **Task [7.2]: AI Turn Emitter Interface**
  - **Goal:** Add a shared AI turn-emitter interface that submits the same validated input as a human player.
  - **Target Files:** `src/ai/aiEmitter.ts`, `src/emitter/Emitter.ts`
  - **Test File:** `tests/ai_emitter.test.ts`
  - **Allowed Context:** `src/emitter/Emitter.ts`, `src/ai/types.ts`
  - **Commit:** `feat: add ai turn interface`
- [x] **Task [7.3]: Deterministic Easy AI**
  - **Goal:** Implement and test deterministic easy AI random angle and force choices.
  - **Target Files:** `src/ai/easyAi.ts`, `src/ai/types.ts`
  - **Test File:** `tests/easy_ai.test.ts`
  - **Allowed Context:** `src/utils/random.ts`, `src/ai/types.ts`
  - **Commit:** `feat: add deterministic easy ai`
- [x] **Task [7.4]: Heuristic Medium AI**
  - **Goal:** Implement medium AI target-angle heuristics with collision and out-of-bounds risk penalties.
  - **Target Files:** `src/ai/mediumAi.ts`, `src/ai/types.ts`
  - **Test File:** `tests/medium_ai.test.ts`
  - **Allowed Context:** `src/physics/physics.ts`, `src/ai/types.ts`
  - **Commit:** `feat: add heuristic medium ai`
- [x] **Task [7.5]: Simulation Hard AI**
  - **Goal:** Implement hard AI bounded angle/force simulation search with a fixed deterministic evaluation budget.
  - **Target Files:** `src/ai/hardAi.ts`, `src/ai/types.ts`
  - **Test File:** `tests/hard_ai.test.ts`
  - **Allowed Context:** `src/engine/Handler.ts`, `src/ai/types.ts`
  - **Commit:** `feat: add simulation hard ai`
- [x] **Task [7.6]: Versus AI Game Mode**
  - **Goal:** Add 1-player-versus-AI game-mode settings and initialize the AI team from those settings.
  - **Target Files:** `src/settings/settings.ts`, `src/engine/Handler.ts`
  - **Test File:** `tests/versus_ai.test.ts`
  - **Allowed Context:** `src/settings/settings.ts`, `src/engine/Handler.ts`
  - **Commit:** `feat: add versus ai mode`
- [x] **Task [7.7]: Authoritative AI Match Coverage**
  - **Goal:** Run AI through the authoritative turn path and add a complete simulated match regression test.
  - **Target Files:** `src/server/gameRegistry.ts`, `src/ai/aiEmitter.ts`
  - **Test File:** `tests/authoritative_ai.test.ts`
  - **Allowed Context:** `src/server/gameRegistry.ts`, `src/ai/aiEmitter.ts`
  - **Commit:** `test: cover authoritative ai match`

## 8. Persistence, Sharing, And Replays

- [x] **Task [8.1]: Define Local Save Slots**
  - **Goal:** Define a versioned local save-slot record containing validated game settings and match snapshot.
  - **Target Files:** `src/persistence/saveSlots.ts`, `src/contracts/documents.ts`
  - **Test File:** `tests/save_slots.test.ts`
  - **Allowed Context:** `src/contracts/documents.ts`, `src/settings/settings.ts`
  - **Commit:** `feat: define local save slots`
- [x] **Task [8.2]: Local Match Storage**
  - **Goal:** Implement local save-slot creation and listing without exposing database files to static HTTP routes.
  - **Target Files:** `src/persistence/storage.ts`, `server.ts`
  - **Test File:** `tests/local_storage.test.ts`
  - **Allowed Context:** `src/persistence/saveSlots.ts`, `server.ts`
  - **Commit:** `feat: save local matches`
- [x] **Task [8.3]: Local Match Restoration**
  - **Goal:** Implement local save-slot restoration through the same settings validator used by networking.
  - **Target Files:** `src/persistence/storage.ts`, `src/settings/settings.ts`
  - **Test File:** `tests/restore_matches.test.ts`
  - **Allowed Context:** `src/persistence/storage.ts`, `src/settings/settings.ts`
  - **Commit:** `feat: restore local matches`
- [x] **Task [8.4]: Version Game Settings Exports**
  - **Goal:** Define a portable `toSettings()` export envelope with schema version and validation metadata.
  - **Target Files:** `src/persistence/export.ts`, `src/contracts/documents.ts`
  - **Test File:** `tests/settings_export.test.ts`
  - **Allowed Context:** `src/contracts/documents.ts`, `src/engine/Handler.ts`
  - **Commit:** `feat: version game settings exports`
- [x] **Task [8.5]: Share Validated Game Settings**
  - **Goal:** Add an authoritative create-or-join path that accepts only validated, allowed settings exports and distributes them in `INIT`.
  - **Target Files:** `src/server/gameRegistry.ts`, `src/server/runtime.ts`
  - **Test File:** `tests/shared_settings.test.ts`
  - **Allowed Context:** `src/server/gameRegistry.ts`, `src/server/runtime.ts`
  - **Commit:** `feat: share validated game settings`
- [x] **Task [8.6]: Define Replay Format**
  - **Goal:** Define a replay document containing initial settings, deterministic seed, accepted actions, and format version.
  - **Target Files:** `src/replay/types.ts`, `src/contracts/documents.ts`
  - **Test File:** `tests/replay_format.test.ts`
  - **Allowed Context:** `src/contracts/documents.ts`, `src/engine/types.ts`
  - **Commit:** `feat: define replay format`
- [x] **Task [8.7]: Record Local Replays**
  - **Goal:** Record accepted local actions into replay data and test export/replay equality.
  - **Target Files:** `src/replay/recorder.ts`, `src/emitter/EngineEmitter.ts`
  - **Test File:** `tests/local_replays.test.ts`
  - **Allowed Context:** `src/replay/types.ts`, `src/emitter/EngineEmitter.ts`
  - **Commit:** `feat: record local replays`
- [x] **Task [8.8]: Record Network Replays**
  - **Goal:** Record accepted authoritative actions into replay data and persist it with the match.
  - **Target Files:** `src/replay/recorder.ts`, `src/server/gameRegistry.ts`
  - **Test File:** `tests/network_replays.test.ts`
  - **Allowed Context:** `src/server/gameRegistry.ts`, `src/replay/recorder.ts`
  - **Commit:** `feat: record network replays`
- [x] **Task [8.9]: Play Deterministic Replays**
  - **Goal:** Implement replay playback from initial settings without live input and test final snapshots.
  - **Target Files:** `src/replay/player.ts`, `src/replay/types.ts`
  - **Test File:** `tests/deterministic_replay.test.ts`
  - **Allowed Context:** `src/replay/types.ts`, `src/engine/Handler.ts`
  - **Commit:** `feat: play deterministic replays`
- [x] **Task [8.10]: Replay Viewer**
  - **Goal:** Add a replay viewer entry point and a malformed/incompatible replay error state.
  - **Target Files:** `src/menu/replayViewer.ts`, `src/main.ts`
  - **Test File:** `tests/replay_viewer.test.ts`
  - **Allowed Context:** `src/menu/Menu.ts`, `src/replay/player.ts`
  - **Commit:** `feat: add replay viewer`

## 9. Desktop, Mobile, And Discord

- [x] **Task [9.1]: Tauri Desktop Shell**
  - **Goal:** Add Tauri project configuration and a minimal desktop launch command that serves the existing built browser application.
  - **Target Files:** `src-tauri/tauri.conf.json`, `package.json`
  - **Test File:** `tests/tauri_config.test.ts`
  - **Allowed Context:** `package.json`, `server.ts`
  - **Commit:** `build: add tauri desktop shell`
- [x] **Task [9.2]: Document Desktop Build**
  - **Goal:** Verify desktop packaging reads no development-only paths and document the release build procedure.
  - **Target Files:** `docs/desktop-release.md`, `package.json`
  - **Test File:** `tests/desktop_packaging.test.ts`
  - **Allowed Context:** `package.json`
  - **Commit:** `docs: document desktop build`
- [x] **Task [9.3]: Offline Mobile Web Shell**
  - **Goal:** Add web-app manifest, icons, and service-worker caching for offline mobile launch.
  - **Target Files:** `public/manifest.json`, `public/sw.js`
  - **Test File:** `tests/mobile_manifest.test.ts`
  - **Allowed Context:** `index.html`, `public/`
  - **Commit:** `feat: add offline mobile web shell`
- [x] **Task [9.4]: Cover Mobile Offline Flow**
  - **Goal:** Verify offline startup, reconnect recovery, and touch controls on a mobile viewport; add a browser smoke test.
  - **Target Files:** `src/main.ts`, `public/sw.js`
  - **Test File:** `tests/mobile_offline.test.ts`
  - **Allowed Context:** `src/main.ts`
  - **Commit:** `test: cover mobile offline flow`
- [x] **Task [9.5]: Configure Discord Integration**
  - **Goal:** Define environment-configured Discord integration settings with no client credentials committed.
  - **Target Files:** `src/discord/config.ts`, `src/discord/types.ts`
  - **Test File:** `tests/discord_config.test.ts`
  - **Allowed Context:** `src/discord/types.ts`
  - **Commit:** `feat: configure discord integration`
- [x] **Task [9.6]: Report Discord Match Presence**
  - **Goal:** Add Discord Rich Presence states for menu, match, map, and active turn behind the configured integration.
  - **Target Files:** `src/discord/presence.ts`, `src/discord/config.ts`
  - **Test File:** `tests/discord_presence.test.ts`
  - **Allowed Context:** `src/discord/config.ts`, `src/engine/Handler.ts`
  - **Commit:** `feat: report discord match presence`
- [x] **Task [9.7]: Support Discord Game Invites**
  - **Goal:** Add Discord join/invite payload handling that validates game identifiers before connecting.
  - **Target Files:** `src/discord/invites.ts`, `src/server/runtime.ts`
  - **Test File:** `tests/discord_invites.test.ts`
  - **Allowed Context:** `src/server/runtime.ts`, `src/discord/config.ts`
  - **Commit:** `feat: support discord game invites`
- [x] **Task [9.8]: Document Discord Configuration**
  - **Goal:** Document required Discord application configuration and verify disabled integration is a no-op.
  - **Target Files:** `docs/discord-setup.md`, `src/discord/presence.ts`
  - **Test File:** `tests/discord_noop.test.ts`
  - **Allowed Context:** `src/discord/presence.ts`
  - **Commit:** `docs: document discord configuration`

## 10. Final Hardening And Release Readiness

- [x] **Task [10.1]: Cover Complete Local Match**
  - **Goal:** Add end-to-end coverage for a local match with items, hazards, elimination, result, reset, and replay.
  - **Target Files:** `tests/local_match_lifecycle.integration.test.ts`, `src/engine/Handler.ts`
  - **Test File:** `tests/local_match_lifecycle.integration.test.ts`
  - **Allowed Context:** `src/engine/Handler.ts`, `src/item/officialItems.ts`
  - **Commit:** `test: cover complete local match`
- [x] **Task [10.2]: Cover Complete Network Match**
  - **Goal:** Add end-to-end coverage for a network match with item authority, disconnect/reconnect, result, and replay persistence.
  - **Target Files:** `tests/e2e_network_match.test.ts`, `src/server/gameRegistry.ts`
  - **Test File:** `tests/e2e_network_match.test.ts`
  - **Allowed Context:** `src/server/gameRegistry.ts`, `src/server/runtime.ts`
  - **Commit:** `test: cover complete network match`
- [x] **Task [10.3]: Harden Untrusted Game Inputs**
  - **Goal:** Add malformed schema, invalid packet, and unauthorized action fuzz-style regression cases.
  - **Target Files:** `tests/input_fuzz.test.ts`, `src/server/gameRegistry.ts`
  - **Test File:** `tests/input_fuzz.test.ts`
  - **Allowed Context:** `src/server/gameRegistry.ts`, `src/item/validate.ts`
  - **Commit:** `test: harden untrusted game inputs`
- [x] **Task [10.4]: Harden Declarative Mod Loading**
  - **Goal:** Audit every game-data boundary to ensure external content cannot execute code or bypass the effect whitelist.
  - **Target Files:** `src/item/validate.ts`, `src/contracts/documents.ts`
  - **Test File:** `tests/mod_security.test.ts`
  - **Allowed Context:** `src/item/validate.ts`, `src/contracts/documents.ts`
  - **Commit:** `fix: harden declarative mod loading`
- [x] **Task [10.5]: Remove Obsolete Game Prototypes**
  - **Goal:** Remove obsolete commented prototypes and duplicate paths only after their replacement coverage is complete.
  - **Target Files:** `src/start.ts`, `src/ui/Mouse.ts`
  - **Test File:** `tests/cleanup.test.ts`
  - **Allowed Context:** `src/main.ts`, `src/start.ts`
  - **Commit:** `refactor: remove obsolete game prototypes`
- [x] **Task [10.6]: Document Completed Game Systems**
  - **Goal:** Update `AGENTS.md`, `TODO.md`, GDD implementation notes, and this checklist to reflect the completed feature set.
  - **Target Files:** `AGENTS.md`, `TODO.md`
  - **Test File:** `tests/documentation.test.ts`
  - **Allowed Context:** `AGENTS.md`, `TODO.md`
  - **Commit:** `docs: document completed game systems`
- [x] **Task [10.7]: Record Release Verification**
  - **Goal:** Run clean-install, unit, typecheck, browser-build, server, desktop, and mobile smoke checks; record exact results in release documentation.
  - **Target Files:** `docs/release-verification.md`, `package.json`
  - **Test File:** `tests/release_smoke.test.ts`
  - **Allowed Context:** `package.json`
  - **Commit:** `docs: record release verification`

## 11. Cross-System Validation

- [x] **Task [11.1]: Validate Handler Snapshot Isolation**
  - **Goal:** Prove `handler.toSettings()` produces a complete, defensive engine snapshot that reconstructs a semantically equivalent handler via `GameHandlerBuilder.fromSettings()` and shares no mutable state with the original.
  - **Target Files:** `src/engine/Handler.ts`, `src/entity/Player.ts`
  - **Test File:** `tests/handler_snapshot_isolation.test.ts`
  - **Allowed Context:** `src/engine/Handler.ts`, `src/entity/Player.ts`, `src/emitter/EngineEmitter.ts`
  - **Commit:** `test: validate handler snapshot isolation`
- [x] **Task [11.2]: Validate Isolated Turn Simulation**
  - **Goal:** Prove `simulateTurn()` resolves deterministically on a cloned world without mutating the live handler's entities, rule state, or RNG state.
  - **Target Files:** `src/engine/Handler.ts`
  - **Test File:** `tests/simulate_turn_isolation.test.ts`
  - **Allowed Context:** `src/engine/Handler.ts`
  - **Commit:** `test: validate isolated turn simulation`
- [x] **Task [11.3]: Validate Hard AI Snapshot Isolation**
  - **Goal:** Prove the hard AI computes identical decisions on a snapshot-restored handler and its own simulation never mutates the live match.
  - **Target Files:** `src/ai/hardAi.ts`
  - **Test File:** `tests/hard_ai_snapshot_validation.test.ts`
  - **Allowed Context:** `src/ai/hardAi.ts`, `src/ai/aiEmitter.ts`
  - **Commit:** `test: validate hard ai snapshot isolation`
- [x] **Task [11.4]: Validate AI Match Replay Lifecycle**
  - **Goal:** Prove an AI-vs-AI match records a valid replay that deterministically reproduces the final entity state, and that the replay boundary rejects malformed actions instead of ignoring them.
  - **Target Files:** `src/replay/player.ts`, `src/replay/types.ts`
  - **Test File:** `tests/ai_replay_lifecycle.test.ts`
  - **Allowed Context:** `src/ai/hardAi.ts`, `src/replay/player.ts`, `src/replay/types.ts`, `src/emitter/EngineEmitter.ts`
  - **Commit:** `test: validate ai match replay lifecycle`
- [x] **Task [11.5]: Validate Parallel Engine Instances**
  - **Goal:** Prove independent handlers built from the same settings evolve identically and never share state across instances.
  - **Target Files:** `src/engine/Handler.ts`
  - **Test File:** `tests/parallel_engine_instances.test.ts`
  - **Allowed Context:** `src/engine/Handler.ts`
  - **Commit:** `test: validate parallel engine instances`
- [x] **Task [11.6]: Validate Persisted Match Continuation**
  - **Goal:** Prove a persisted SQLite game snapshot restores a running match with identical rule state, and malformed persisted snapshots are rejected.
  - **Target Files:** `src/server/db.ts`, `src/server/gameRegistry.ts`
  - **Test File:** `tests/persisted_match_continuation.test.ts`
  - **Allowed Context:** `src/server/db.ts`, `src/server/gameRegistry.ts`, `src/engine/Handler.ts`
  - **Commit:** `test: validate persisted match continuation`
- [x] **Task [11.7]: Validate Winning Lifecycle Composition**
  - **Goal:** Prove the winning evaluation composes with boundary elimination, sets the match result once, and survives snapshot restoration.
  - **Target Files:** `src/systems/WinningSystem.ts`
  - **Test File:** `tests/winning_lifecycle_validation.test.ts`
  - **Allowed Context:** `src/systems/WinningSystem.ts`, `src/engine/Handler.ts`
  - **Commit:** `test: validate winning lifecycle composition`
- [x] **Task [11.8]: Validate Item Effect Snapshot Continuity**
  - **Goal:** Prove item-triggered effects serialize their remaining state and continue correctly after snapshot restoration.
  - **Target Files:** `src/effects/shield.ts`, `src/effects/freeze.ts`
  - **Test File:** `tests/item_effect_snapshot_validation.test.ts`
  - **Allowed Context:** `src/effects/*.ts`, `src/item/officialItems.ts`
  - **Commit:** `test: validate item effect snapshot continuity`
- [x] **Task [11.9]: Validate Action Path Consistency**
  - **Goal:** Prove the emitter, AI, server, and replay action paths reject the same invalid inputs and leave the match unchanged after rejection.
  - **Target Files:** `src/server/gameRegistry.ts`, `src/emitter/EngineEmitter.ts`
  - **Test File:** `tests/action_path_consistency.test.ts`
  - **Allowed Context:** `src/server/gameRegistry.ts`, `src/emitter/EngineEmitter.ts`, `src/ai/aiEmitter.ts`
  - **Commit:** `test: validate action path consistency`
- [x] **Task [11.10]: Record Cross-System Validation**
  - **Goal:** Document the cross-system validation suite with exact pass counts and a smoke test referencing every section 11 test file.
  - **Target Files:** `docs/release-verification.md`, `requirements.md`, `AGENTS.md`
  - **Test File:** `tests/cross_system_validation_smoke.test.ts`
  - **Allowed Context:** `tests/*.test.ts`
  - **Commit:** `docs: record cross-system validation`

## 12. Engine Defect Hardening And Release Candidate Qualification

- [x] **Task [12.1]: Separate Containment From Solid Obstacles**
  - **Goal:** Introduce an explicit structure collision-purpose role contract (`"solid"`, `"containment"`, `"both"`) on `MapBoundarySettings` and the structure classes so containment boundaries are interpreted by the containment/boundary system only and never resolve as filled solid obstacles unless explicitly configured to serve both roles.
  - **Target Files:** `src/physics/physics.ts`, `src/settings/settings.ts`, `src/structures/*.ts`, `src/systems/PhysicsSystem.ts`
  - **Test File:** `tests/containment_structure_role.test.ts`
  - **Allowed Context:** `src/structures/*.ts`, `src/systems/PhysicsSystem.ts`, `src/systems/BoundarySystem.ts`, `src/settings/settings.ts`, `src/physics/physics.ts`
  - **Commit:** `fix: separate containment from solid obstacles`
- [x] **Task [12.2]: Resolve Embedded Circle/Rectangle Collisions Deterministically**
  - **Goal:** Replace the undefined zero-distance circle/rectangle fallback normal with a deterministic nearest-edge exit (including tie-breaking for exact center or equal-edge-distance cases) so embedded entities are depenetrated without altering an unrelated velocity axis or drifting inside containment-only geometry.
  - **Required Invariant:** One collision resolution must apply a deterministic minimum translation that leaves the circle non-overlapping with the selected rectangle, except where an explicitly documented bounded iterative solver is used and strict monotonic penetration reduction is proven.
  - **Target Files:** `src/physics/defaultPhysics.ts`
  - **Test File:** `tests/circle_rectangle_interior_collision.test.ts`
  - **Allowed Context:** `src/physics/defaultPhysics.ts`, `src/physics/physics.ts`
  - **Commit:** `fix: resolve embedded circle/rectangle collisions deterministically`
- [x] **Task [12.3]: Apply Playback Final Sync After All Gameplay Mutation**
  - **Goal:** Move playback final-state synchronization to the final mutation phase of the handler tick so no physics, effects, structures, or gameplay systems can alter `TurnPacket.finalState` afterward.
  - **Target Files:** `src/engine/Handler.ts`, `src/systems/PlayBackSystem.ts`
  - **Test File:** `tests/playback_sync_order.test.ts`
  - **Allowed Context:** `src/systems/PlayBackSystem.ts`, `src/engine/Handler.ts`, `src/systems/PhysicsSystem.ts`
  - **Commit:** `fix: finalize playback sync after gameplay mutation`
  - **Note:** `ISystem` gained an optional `flush(ctx)` hook; `GameHandler.tick()` invokes it after post-tickers. Playback sync now completes the countdown tick itself (playback length = exactly `durationFrames` ticks). The completion callback no longer clobbers a terminal `Game_over` state set by gameplay systems on the sync tick.
- [x] **Task [12.4]: Enforce Deterministic Per-Turn Frame Counts**
  - **Goal:** Establish one documented deterministic frame-count contract for both the authoritative `resolveTurn` path and the live `playTurn` path (identical inputs, identical tick counts, identical final state) and add a regression test.
  - **Target Files:** `src/engine/Handler.ts`, `src/systems/PlayBackSystem.ts`
  - **Test File:** `tests/per_turn_frame_contract.test.ts`
  - **Allowed Context:** `src/engine/Handler.ts`, `src/systems/PlayBackSystem.ts`, `src/physics/defaultPhysics.ts`
  - **Commit:** `fix: enforce deterministic per-turn frame counts`
  - **Note:** The contract (from 12.3): live playback runs exactly `durationFrames` ticks and completes with live state equal to `TurnPacket.finalState`. Tests cover six shots on the ice map, restored-handler repeats, and repeated authoritative resolutions from identical snapshots.
- [x] **Task [12.5]: Complete Accepted Turns Before Match Finalization**
  - **Goal:** Ensure a winner or draw detected during active playback is finalized only after the accepted turn reaches its authoritative final state. Winning detection may become pending during playback, but must not cancel playback, skip the final sync, or expose a partial completed-match snapshot.
  - **Target Files:** `src/systems/WinningSystem.ts`, `src/systems/PlayBackSystem.ts`, `src/engine/Handler.ts`
  - **Test File:** `tests/playback_match_finalization.test.ts`
  - **Allowed Context:** `src/systems/WinningSystem.ts`, `src/systems/PlayBackSystem.ts`, `src/engine/Handler.ts`
  - **Commit:** `fix: complete accepted turns before match finalization`
  - **Note:** `WinningSystem` now pends wins detected while `Playing` (capturing the detection turn). `PlaybackSystem.flush` transitions to `Playing_done` after the hard sync; `WinningSystem.flush` (registered after Playback) then finalizes with the captured turn. The playback completion callback was split into `flush` (sync) + `drainCompletion()` (fired by the handler after all flush hooks), so the rule state is never advanced past a decided match. Post-completion physics freezing is 12.8's scope.
- [x] **Task [12.6]: Restore Rule-State Orchestration For Replays**
  - **Goal:** Prove replay playback restores and advances turn number, rule phase, item economy, and active-team state exactly as the live match did, including turn/phase ordering assertions across the full replay lifecycle.
  - **Constraint:** `ReplayPlayer` must invoke the same authoritative domain transitions as the original action path. It must not manually increment turn numbers, phases, active teams, or item counters as a parallel replay-only rules implementation.
  - **Target Files:** `src/replay/player.ts`, `src/rules/RuleInterpreter.ts`
  - **Test File:** `tests/replay_rule_state_orchestration.test.ts`
  - **Allowed Context:** `src/replay/*.ts`, `src/rules/*.ts`, `src/emitter/EngineEmitter.ts`
  - **Commit:** `fix: restore rule-state orchestration for replays`
  - **Note:** `ReplayPlayer` now drives a `GameEmitter` (built from the recorded game mode, team count, and seed) through `sendShot`/`sendItemUse` + `skipCurrentPhase`, so turn numbers, rule phases, item economy, and active-team progression come from the authoritative emitter path only. `ai_replay_lifecycle` now asserts full `toSettings()` equality between live and replayed matches, and `replay_rule_state_orchestration` proves per-action rule-state equality (phase, turn, team, item uses) plus full item-mode match reproduction incl. `Game_over` results. Test arena uses mid-field shots because resting players near an arena edge are deterministically pushed out by the interior depenetration of `containment_structure_role`.
- [x] **Task [12.7]: Model Explicit Match Status Results**
  - **Goal:** Replace winner/draw ambiguity with an explicit `{ status: "ongoing" | "winner" | "draw" }` match-status model that never invents fake team IDs for draws.
  - **Target Files:** `src/rules/types.ts`, `src/systems/WinningSystem.ts`
  - **Test File:** `tests/match_status_model.test.ts`
  - **Allowed Context:** `src/rules/types.ts`, `src/systems/WinningSystem.ts`
  - **Commit:** `feat: model explicit match status results`
  - **Note:** `MatchResult` now carries an explicit `status: MatchStatus` (`ongoing` | `winner` | `draw`); draws store `winnerTeam: null` and `reason: Draw`, and consumers must branch on `status`. `evaluateLastTeamStanding` returns a discriminated `LastTeamStandingEvaluation` (Ongoing/Winner/Draw) so zero living teams is a first-class draw instead of an ambiguous `undefined`; `WinningSystem` pends and finalizes draws like wins (the latest pre-sync evaluation wins, so a team eliminated later in the same turn turns a pending win into a draw). `Handler.drawUI` branches on `status`. `match_status_model` proves evaluator discrimination, absent ongoing results, explicit winner results with snapshot round trips, and a simultaneous-elimination draw (both figures die in one turn) with `winnerTeam: null` that survives `toSettings()` round trips. The draw fixture needed the kill circle at reachable distance because the interior depenetration of `containment_structure_role` reverses a straight-down shot after ~69 frames.
- [x] **Task [12.8]: Freeze Gameplay After Final Match Completion**
  - **Goal:** Once the accepted final turn has completed, its authoritative final state has been synchronized, and the match result has been stored, prevent every later gameplay tick from mutating entities, effects, structures, rules, inventories, or outcome state.
  - **Target Files:** `src/engine/Handler.ts`, `src/systems/*.ts`
  - **Test File:** `tests/match_completion_gate.test.ts`
  - **Allowed Context:** `src/engine/Handler.ts`, `src/systems/*.ts`, `src/effects/*.ts`
  - **Commit:** `fix: gate gameplay systems on match completion`
  - **Note:** `GameHandler.tick()` now no-ops once the match is `Game_over`, so the post-sync interior depenetration can no longer drift resting players and nothing may mutate the completed snapshot. `simulateTurn`, `resolveTurn`, `playTurn`, and `applyRawTurn` throw `completed match` errors on a finished match; `rematch()` is the only sanctioned resume path. One deliberate exception: an in-flight `resolveTurn` (flagged `resolvingTurn`) keeps ticking even when the deciding tick completes the match mid-loop, because that loop IS the accepted turn's resolution - without it the authoritative chain froze the survivor mid-flight at the kill frame and spun to the 1200-frame cap, diverging from the emitter's sim (the `ai_replay_lifecycle` chain-vs-replay assertion caught this). `match_completion_gate` proves frozen no-op ticks, rejected entry points, frozen snapshot restoration, rematch unfreezing, and that ongoing matches are unaffected. The rematch case uses a shot-driven kill because a spawn-inside-kill-circle arena re-dies on the first post-rematch tick.
- [x] **Task [12.9]: Unify Winner State With The Match Result**
  - **Goal:** Remove the mutable winner duplicate inside `WinningSystem` so snapshot restoration, replay, and the live handler agree on the single authoritative `MatchResult`.
  - **Target Files:** `src/systems/WinningSystem.ts`, `src/engine/Handler.ts`
  - **Test File:** `tests/winner_state_unification.test.ts`
  - **Allowed Context:** `src/systems/WinningSystem.ts`, `src/engine/Handler.ts`
  - **Commit:** `refactor: unify winner state with match result`
  - **Note:** `WinningSystem` no longer keeps a `winner` field or `getWinner()` (it had zero callers); `finalize` only stores the `MatchResult` through `ctx.setMatchResult`, so the live handler, restored snapshots, and replay playback share exactly one outcome state. `winner_state_unification` proves the result is the only winner state (no top-level snapshot key carries it), no outcome is observable mid-playback, restored and replayed handlers agree with the live `MatchResult`, and draws unify identically.
- [x] **Task [12.10]: Make Settings Export Pure**
  - **Goal:** Prove `handler.toSettings()` is a pure export that never mutates stored settings or internal state, with snapshot-equality assertions before and after repeated exports.
  - **Target Files:** `src/engine/Handler.ts`
  - **Test File:** `tests/settings_export_purity.test.ts`
  - **Allowed Context:** `src/engine/Handler.ts`
  - **Commit:** `refactor: make settings export pure`
  - **Note:** `toSettings()` previously retained the returned object itself via `saveSettings`, so caller mutations of an export polluted the stored settings and all later exports. It now stores only a detached deep copy (keeping the existing "settings reflects the latest engine snapshot" contract for `getSettings()` consumers), and the export shares no references with internal state. `settings_export_purity` proves repeated exports are equal and mutation-free, caller pollution never leaks, the export is deep-detached from the live handler, item-economy/draw state only advances by consuming turns (never by exporting), and restored handlers export purely too.
- [x] **Task [12.11]: Harden The Effect Factory Against Unknown Types**
  - **Goal:** Make `MetaEffect` reject or explicitly handle unknown effect types instead of silently falling back to movement, and cover the missing freeze/shield/ghost/multi serialized cases with round-trip tests.
  - **Target Files:** `src/effects/effects.ts`
  - **Test File:** `tests/effect_factory_roundtrip.test.ts`
  - **Allowed Context:** `src/effects/*.ts`, `src/entity/Player.ts`
  - **Commit:** `fix: harden effect factory against unknown types`
  - **Note:** `MetaEffect` now throws `Unknown effect type` for anything outside the registered `EffectType` set instead of silently constructing an `EffectMove`. `EffectType.Multi` is a real `MultiEffect` that applies its `typeValue` child-settings array in order and round-trips it (recursively); malformed Multi settings are rejected. The hardening exposed a latent section-11 defect: `handler_snapshot_isolation` used `EffectType.Shield` (which does not exist - shields live in the item-effect pipeline), so the effect had silently been movement; the fixture now uses a valid fully-structured `ModifySetting` effect, and remaining-state round trips stay covered by `item_effect_snapshot_validation`. `effect_factory_roundtrip` covers every registered engine type, unknown/undefined/null rejection, ordered Multi application with recursion, malformed-Multi rejection, and freeze/shield/ghost serialized round trips preserving remaining turns/capacity. AGENTS.md limitation list updated.
- [x] **Task [12.12]: Deterministic AI-Vs-AI Game-Fuzz Suite**
  - **Goal:** Ship a deterministic AI-vs-AI fuzz harness (`tests/support/aiMatchFuzz.ts`) with per-match/per-turn invariants, negative-action injection, repeat-same-case determinism, replay/persistence/rematch verification, and `RC_GAME_COUNT`-controlled smoke/RC/soak runs wired into package scripts.
  - **Target Files:** `package.json`
  - **Test File:** `tests/ai_match_fuzz.test.ts`
  - **Allowed Context:** `tests/support/aiMatchFuzz.ts`, `src/ai/*.ts`, `src/engine/Handler.ts`, `src/emitter/EngineEmitter.ts`
  - **Commit:** `test: add deterministic ai match fuzz suite`
  - **Note:** The harness derives ALL randomness (arena kill-circle placement, AI seeds, injection schedule) from each match's integer seed, so every case is repeatable. Per-turn invariants: state machine, active team, exact turn progression (terminal turn keeps its number because the deciding tick skips rule advancement), finite entity positions/velocities, rule phase, and terminal result consistency (`Winner` needs a valid team, `Draw` needs `winnerTeam: null`). Negative actions (out-of-range angle/power, NaN, unknown actor, dead actor, out-of-phase item use) must be rejected without mutating the match - verified via pre/post `toSettings()` comparison. The AI decision boundary (wrong-team or dead actor filtered by `AiTurnEmitter`) is verified with a fake producer and a throwing fake emitter. Per match: replay via `ReplayPlayer` reproduces the live final snapshot, `toSettings()` -> `fromSettings()` round-trips, and `rematch()` resets a completed match. First fuzz case is re-run for repeat-same-case determinism. Smoke default is 25 matches (~1.2s); `test:fuzz:rc` (1000 matches, ~36s) and `test:fuzz:soak` (5000 matches) scripts added to package.json. The RC run needs an explicit 600s test timeout (bun's 5s default aborts the big test).
- [x] **Task [12.13]: Qualify The Release Candidate**
  - **Goal:** Run the full release-candidate gate (clean install, unit suite, typecheck, build, RC fuzz run, desktop build), record the 24-point report in `docs/release-verification.md`, and update `requirements.md`, `AGENTS.md`, and this checklist.
  - **Target Files:** `docs/release-verification.md`, `requirements.md`, `AGENTS.md`, `package.json`
  - **Test File:** `tests/release_candidate_gate.test.ts`
  - **Allowed Context:** everything in this repository
  - **Commit:** `docs: qualify release candidate`
  - **Note:** Full gate executed and recorded in `docs/release-verification.md` (24 numbered qualification points): `bun install --frozen-lockfile` clean (276 installs, no changes), `bun test` 425 pass / 0 fail / 2221 assertions across 157 files [3.23s], `npx tsc --noEmit` clean, `bun run build` succeeded, `bun run test:fuzz:rc` 1000 matches / 6010 assertions / 0 fail [35.71s], `bun run test:fuzz:soak` 5000 matches / 30010 assertions / 0 fail [180.64s], and `bun run desktop:build` produced the release binary plus Debian bundle. `tests/release_candidate_gate.test.ts` (5 tests) asserts the 24-point record with the current suite size, the Section 12 evidence files, the 12.1-12.13 checklist flips, the wired fuzz scripts, and a clean 5-match fuzz smoke run. `requirements.md` R-15 and the AGENTS.md toolchain/section-12 documentation updated to the current evidence.

## 13. Physics Solver Hardening And Continuous Collision Qualification

Section 13 strengthens the mathematical and runtime guarantees of the physics solver.

Section 12 established deterministic containment roles, deterministic embedded circle/rectangle correction, exact playback frame counts, final-state synchronization, replay equivalence, and release-candidate fuzzing. Section 13 must now prove that collision resolution itself produces stable, non-overlapping, deterministic, and physically coherent states.

Do not weaken Section 12 regression tests.

Every task must be implemented as one atomic commit.

For every source change:

```sh
bun test <focused-test-file>
bun test
npx tsc --noEmit
```

Run `bun run build` whenever exported types, runtime behavior, or packaging are affected.

Use deterministic fixtures and seeded random generation only.

- [x] **Task [13.1]: Define The Physics Contact And Resolution Contract**
  - **Goal:** Document and encode the exact semantics for contact detection, penetration, touching, collision resolution, restitution, friction, mass handling, and immovable bodies.
  - **Target Files:** `src/physics/physics.ts`, `src/physics/defaultPhysics.ts`, `docs/physics-contract.md`
  - **Test File:** `tests/physics_contact_contract.test.ts`
  - **Allowed Context:** `src/physics/*.ts`, `src/structures/*.ts`, existing physics tests
  - **Commit:** `docs: define physics contact and resolution contract`
  - **Note:** `docs/physics-contract.md` defines the full contract (15 clauses) with a task-enforcement matrix; `src/physics/physics.ts` encodes the contract constants (`PHYSICS_CONTACT_EPSILON`, `PHYSICS_CONTACT_SLOP`, `PHYSICS_CONTACT_PERCENT`, `MAX_CONTACT_SOLVER_ITERATIONS`, `MAX_COLLISION_IMPULSE`) plus `isFiniteVector` and `validatePhysicsBody` (rejects non-finite position/velocity, non-finite/negative/zero-circle bounds, non-positive or non-finite mass except `Infinity`, and bounce outside `[0, 1]` except the `Infinity` inherit marker); `defaultPhysics.handleCollision` now defensively ignores non-finite input state so no response can produce `NaN`/`Infinity`. `tests/physics_contact_contract.test.ts` (11 tests, 1858 assertions): separated bodies unchanged, 500-tick touching stability for circle/circle and circle/rect, exact circle/circle correction formula (slop/percent), exterior shallow rect resolution, interior min-axis exit with left/top tie order, immovable partners fixed, bit-identical duplicate runs, invalid-value rejection, non-finite input guard, monotone overlap convergence to the slop residual, and containment-only structures never entering solid resolution (counted strategy through `PhysicsSystem`). Known current behavior documented for later tasks: circle/circle correction is partial (20% beyond slop per call), the circle/rect embedded correction still has the legacy 2.0-unit clamp (full depenetration is 13.2), and zero-distance circle/circle contacts still early-return (13.3).
- [x] **Task [13.2]: Fully Resolve Embedded Circle And Rectangle Contacts**
  - **Goal:** Replace the current externally iterative two-unit correction for embedded circle/rectangle contacts with a complete deterministic minimum-translation resolution inside one physics tick.
  - **Target Files:** `src/physics/defaultPhysics.ts`
  - **Test File:** `tests/circle_rectangle_full_depenetration.test.ts`
  - **Allowed Context:** `src/physics/defaultPhysics.ts`, `tests/circle_rectangle_interior_collision.test.ts`
  - **Commit:** `fix: fully depenetrate circle rectangle contacts`
  - **Required Invariants:**
    - one collision-resolution call leaves the circle non-overlapping,
    - the minimum valid exit axis is selected,
    - equal-distance ties use the documented stable order,
    - no arbitrary negative-Y fallback exists,
    - no second correction is required on the next tick,
    - velocity axes unrelated to the contact remain unchanged.
  - **Positive Tests:**
    - nearest-left, nearest-right, nearest-top, and nearest-bottom exits,
    - exact-center tie,
    - two-way and four-way equal-distance ties,
    - exterior edge penetration,
    - finite-mass rectangle displacement,
    - immovable rectangle correction.
  - **Negative Tests:**
    - deep embedding cannot remain after the physics tick,
    - the resolver cannot oscillate between edges,
    - correction cannot move the circle farther into the rectangle,
    - containment rectangles never invoke this solver.
  - **Note:** `defaultPhysics.handleCollision` now resolves every embedded circle/rectangle contact with the full minimum translation (`overlap + 0.01`): one call leaves the circle non-overlapping, the nearest exit axis wins, ties follow left/right/top/bottom, the next tick is a no-op, and velocity axes stay untouched. `tests/circle_rectangle_full_depenetration.test.ts` (17 tests + 3 opt-in long sweeps behind `DEPENETRATION_LONG=1`) covers the required positive/negative lists; the contract-shape expectations in `tests/circle_rectangle_interior_collision.test.ts` were updated to the one-call full-exit semantics (exact-center `{x:29.99,y:50}`, mass-weighted `+5.005/-5.005`, single-iteration deep penetration). The full-depenetration contract forbids resting embedded inside a solid rect, so every Section-12 arena fixture that previously relied on the 2.0-unit squeeze was recalibrated: the arena rect became an explicit `"containment"`-role boundary (no solid resolution - `PhysicsSystem.isContainmentOnly`), kill-circle spawns moved off the exact circle center (the zero-distance circle/circle early return remains for 13.3), and the deterministic AI-match fixtures (convergence kill circle at (1500,730), narrow boundary-ram arena) were re-verified with their new hard numbers (winner team 0, turn 24 / turn 2). The fuzz smoke gate test gained the established explicit `{ timeout: 600000 }`. Suite: 462 tests / 160 files / 0 fail (458 pass, 3 skip), TSC clean, build OK.
- [x] **Task [13.3]: Resolve Zero-Distance Circle And Circle Contacts**
  - **Goal:** Replace the current `distance === 0` early return for overlapping circles with a deterministic and complete resolution.
  - **Target Files:** `src/physics/defaultPhysics.ts`
  - **Test File:** `tests/circle_circle_zero_distance.test.ts`
  - **Allowed Context:** `src/physics/defaultPhysics.ts`, `src/entity/*.ts`
  - **Commit:** `fix: resolve zero distance circle contacts`
  - **Required Invariants:**
    - coincident circles are separated,
    - identical inputs choose an identical correction axis,
    - finite masses split correction proportionally,
    - an infinite-mass body remains fixed,
    - no artificial energy is introduced without configured restitution.
  - **Positive Tests:**
    - equal mass,
    - unequal mass,
    - one immovable body,
    - both bodies initially stationary,
    - moving coincident bodies,
    - repeated seeded execution.
  - **Negative Tests:**
    - no early return leaves bodies overlapping,
    - no random direction is used,
    - entity iteration order cannot change the result,
    - no non-finite velocity or position is produced.
  - **Note:** The `distance === 0` early return in `defaultPhysics.handleCollision` is removed. Coincident circles now resolve through the established 13.1 circle/circle correction model: penetration equals the combined radius, the deterministic canonical fallback axis is `(1, 0)` (first body corrected toward `-X`, second toward `+X`), the correction is `max(overlap - slop, 0) * percent` split by inverse mass, and `mass === Infinity` bodies never move. The impulse stays a separate concept: only a negative relative normal velocity along the selected axis triggers the restitution response, so stationary, separating, and identically-moving bodies never gain collision energy; the both-immovable edge case is guarded (`totalInvMass > 0`) so no `NaN`/`Infinity` can be produced. At the `PhysicsSystem` boundary the pair order is entity storage order, so the body assignment is a pure function of storage order; swapping `handleCollision` arguments mirrors the resolved state along the axis, and for equal masses the unordered world state is identical. The removal also restores the exact-center contact path: a player spawned exactly at the center of a kill circle now collides, is depenetrated, and receives the kill effect (`DeadlyObstacleCirle` fixture). `tests/circle_circle_zero_distance.test.ts` (26 tests, 1277 assertions) covers the documented axis, radii, mass split (equal/unequal/immovable/both-immovable), velocity and energy rules (stationary, identical-velocity, separating, perpendicular, approaching with restitution 0/1, momentum conservation, no energy increase), ordering (argument mirror, insertion-order equivalence through `PhysicsSystem`, deterministic boundary pair order), convergence to the slop residual, and the kill-circle regression. Suite: 485 tests / 161 files / 0 fail (3 skip), TSC clean, build OK, standard 25-match fuzz suite passes unchanged.
- [x] **Task [13.4]: Stabilize Circle, Line, Endpoint, And Corner Contacts**
  - **Goal:** Define and validate collision behavior against line segments, endpoints, rectangle corners, and exact geometric transition points.
  - **Target Files:** `src/physics/defaultPhysics.ts`, `src/structures/structureLine.ts`
  - **Test File:** `tests/line_endpoint_collision.test.ts`
  - **Allowed Context:** `src/physics/*.ts`, `src/structures/structureLine.ts`
  - **Commit:** `fix: stabilize line and corner collisions`
  - **Positive Tests:**
    - perpendicular line impact,
    - glancing line impact,
    - endpoint impact,
    - exact endpoint-center alignment,
    - rectangle-corner impact,
    - transition from edge normal to corner normal,
    - immovable and finite-mass line structures.
  - **Negative Tests:**
    - no normal-direction discontinuity creates extreme velocity,
    - no endpoint tunnelling,
    - no repeated correction after separation,
    - no division by zero for zero-length lines.
  - **Validation:** Reject or explicitly normalize zero-length line structures at the settings boundary.
  - **Note:** The circle/line branch of `defaultPhysics.handleCollision` now implements the full segment contract: the closest point is the projection of the circle center onto the stored start-to-end direction with the parameter clamped to `[0, 1]` (`t === 0` start endpoint, `t === 1` end endpoint, `0 < t < 1` interior); the normal is `normalize(center - closest)`. The silent `distance === 0` early return is gone: a zero-distance contact (center exactly on the segment or an endpoint) uses the canonical left-hand perpendicular `(-dy, dx) / length` of the stored line direction - swapping the line direction mirrors the fallback, and no arbitrary negative-Y normal exists. Separated and exactly touching contacts are stable no-ops (no correction, no impulse, no event); only strict penetration (including zero distance) resolves, repositioning the circle to exactly touch the segment in one call (existing full-depenetration line contract), so the next call is a no-op. The impulse stays separate: only approaching normal velocity (`v·n < 0`) reflects with `min(eA, eB)` restitution; the tangential component is preserved and separating/stationary contacts never receive an impulse. Rectangle corners needed no code change - they already use the radial closest-point normal (exterior) with the 13.2 interior minimum-exit solver for exact corner-center overlaps; the transition sweep proves bounded speed, finite state, and no unresolved penetration. Zero-length lines are now rejected at `StructureLine` construction (`"Line structures must have non-zero length"`, plus non-finite coordinate rejection); `closestPointOnLine` keeps its `lengthSq === 0` factor-0 fallback defensively only. `tests/line_endpoint_collision.test.ts` (29 tests, 194 assertions) covers line interior (perpendicular horizontal/vertical, glancing tangential preservation, stable touching 500-tick, separating no-second-impulse, penetration resolution, repeated-call no-op), endpoints (start/end radial normals, exact start/end-center overlaps, on-segment and diagonal zero-distance canonical perpendicular, glancing endpoint bounded, direction-swap mirror, bit-identical reruns), rectangle corners (all four corners with the 13.2 radial contract, exact corner-center tie-order exit, edge-to-corner sweep with bounded speed, second-call no-op, edge-normal next to a corner), degenerate lines (zero-length and non-finite rejection, 1e-9-length safe handling), and numeric safety (finite state across contact kinds, no division by zero, impulse speed bounds). The existing `tests/line_collision.test.ts` player fixtures (elastic bounce 1 reflection) keep passing unchanged. Suite: 514 tests / 162 files / 0 fail (3 skip), TSC clean, build OK, standard 25-match fuzz suite passes unchanged.
- [x] **Task [13.5]: Make Multi-Contact Resolution Deterministic**
  - **Goal:** Resolve entities touching multiple structures or entities in a stable order without oscillation, order-dependent winners, or unresolved penetration.
  - **Target Files:** `src/systems/PhysicsSystem.ts`, `src/physics/defaultPhysics.ts`
  - **Test File:** `tests/multi_contact_solver.test.ts`
  - **Allowed Context:** `src/systems/PhysicsSystem.ts`, `src/physics/defaultPhysics.ts`
  - **Commit:** `fix: stabilize multi contact resolution`
  - **Required Invariants:**
    - contact processing order is explicit and deterministic,
    - entity insertion order does not change the final result,
    - structure insertion order does not change the final result,
    - the solver terminates within a fixed iteration bound,
    - each solver iteration makes measurable progress,
    - final state contains no unresolved supported penetrations.
  - **Positive Tests:**
    - circle between two walls,
    - circle in a corner,
    - three-circle chain,
    - multiple circles against one wall,
    - simultaneous entity and structure contacts.
  - **Negative Tests:**
    - no left/right oscillation,
    - no energy explosion,
    - no iteration-limit success with unresolved contact,
    - no dependence on array or map iteration order.
  - **Note:** `PhysicsSystem.resolveAllCollisions` executes bounded iterative resolution up to `MAX_CONTACT_SOLVER_ITERATIONS = 16` passes per tick. Active penetration above slop is measured per pair via `getOverlapDistance` (`overlap - PHYSICS_CONTACT_SLOP` for circle/circle, `overlap - 0.01` for circle/rectangle and circle/line). Iterations break early when `totalOverlap <= 1e-4`. If penetration progress stalls (`progress < 1e-4` on pass 15), `Error("Unresolved penetration after max solver iterations")` is thrown. Structure and entity `onCollision` effect invocations are deduplicated per pair per tick using `contactedPairsThisTick`, preventing duplicated effect triggers during multi-pass solver iterations per Section 12. `tests/multi_contact_solver.test.ts` (9 tests) covers parallel wall compression, corner pinching, 3-circle chain propagation, simultaneous contacts, stability over 100 ticks, energy conservation bounds, order independence, and trapped geometry exception handling. Suite: 523 tests / 163 files / 0 fail (3 skip), TSC clean, build OK, standard 25-match fuzz suite passes unchanged.
- [x] **Task [13.6]: Prevent High-Speed Tunnelling**
  - **Goal:** Prevent circles from crossing thin walls, line segments, hazards, or other entities between discrete frames at supported gameplay speeds.
  - **Target Files:** `src/physics/defaultPhysics.ts`, `src/systems/PhysicsSystem.ts`
  - **Test File:** `tests/continuous_collision_detection.test.ts`
  - **Allowed Context:** `src/physics/*.ts`, `src/systems/PhysicsSystem.ts`
  - **Commit:** `feat: add continuous collision detection`
  - **Implementation Constraint:** Use swept tests, deterministic substeps, or another explicitly documented continuous-collision technique. Do not rely on arbitrary global speed caps unless the game contract explicitly requires them.
  - **Positive Tests:**
    - fast circle versus thin rectangle,
    - fast circle versus line,
    - two fast circles moving toward one another,
    - diagonal corner crossing,
    - collision with kill hazards,
    - exact contact at the final substep.
  - **Negative Tests:**
    - no object may appear on the opposite side without a collision,
    - no duplicate collision event from substeps,
    - no frame-rate-dependent outcome,
    - no unbounded substep count.
  - **Implementation Note:** Added `CCD_MAX_STEP_SIZE = 4.0` and `MAX_CCD_SUBSTEPS = 16` to `src/physics/physics.ts`. When max entity displacement per tick exceeds `CCD_MAX_STEP_SIZE`, `PhysicsSystem.ticker` rewinds entities to start-of-tick positions and advances them in `min(ceil(displacement/4), 16)` substeps of `dt/N`, calling `resolveAllCollisions` at each substep. A single `contactedPairsThisTick` set spans all substeps so `onCollision` triggers at most once per pair per tick. Structure identity is stable via cached `_physicsId` property assigned on first access. Updated `DeadlyObstacleCircle.onCollision` to call `entity.addHP(-100)`. Updated `Player.addHP` to set `dead=true` when hp≤0. All 9 CCD tests pass. Recalibrated float assertions in `engine_test.ts` (`toBeCloseTo`) and deterministic AI turn counts in `ai_replay_lifecycle.test.ts` (24→30 turns, 25→31 actions). Gates: 532 pass / 3 skip / 0 fail across 164 files; TSC clean; build clean; fuzz 25/25 clean.
- [x] **Task [13.7]: Validate Energy, Restitution, Friction, And Rest States**
  - **Goal:** Prove that movement, friction, linear drag, collision restitution, and stop thresholds behave coherently and do not create energy or perpetual jitter.
  - **Target Files:** `src/physics/defaultPhysics.ts`, movement and physics effects
  - **Test File:** `tests/physics_energy_invariants.test.ts`
  - **Allowed Context:** `src/physics/*.ts`, `src/effects/*.ts`
  - **Commit:** `test: validate physics energy invariants`
  - **Positive Tests:**
    - zero restitution does not increase kinetic energy,
    - restitution one preserves expected normal energy within the defined numeric contract,
    - friction and drag monotonically reduce speed,
    - stop threshold produces a stable zero velocity,
    - stationary entities remain stationary,
    - drift changes direction only according to configured drift.
  - **Negative Tests:**
    - no collision creates velocity from two stationary bodies,
    - no repeated contact increases speed,
    - no friction value causes sign-flipping jitter,
    - no entity wakes after reaching a valid rest state without a new force.
  - **Implementation Note:** Pure test task — no source changes. `tests/physics_energy_invariants.test.ts` covers: 4 friction/drag monotonicity tests (exponential, linear, stop threshold, no-wake); 4 restitution contract tests (zero-restitution no-energy-increase, restitution-1 energy conservation, stationary no-velocity, separating no-impulse); 3 drift tests (drift=0 direction unchanged, drift=1 speed preserved, drift skipped below stopThreshold); 4 negative tests (no energy from stationary collision, no speed increase over 100 wall-bounce ticks, no sign-flip jitter, no wake after rest). All 16 tests pass. Gates: 548 pass / 3 skip / 0 fail across 165 files; TSC clean.
- [x] **Task [13.8]: Fire Collision Effects Exactly Once Per Contact Event**
  - **Goal:** Distinguish contact entry, persistent contact, and contact exit so collision-triggered effects do not fire once per solver iteration or once per physics substep.
  - **Target Files:** `src/systems/PhysicsSystem.ts`, `src/effects/*.ts`
  - **Test File:** `tests/collision_effect_lifecycle.test.ts`
  - **Allowed Context:** `src/systems/PhysicsSystem.ts`, `src/effects/*.ts`, `src/item/*.ts`
  - **Commit:** `fix: stabilize collision effect lifecycle`
  - **Required Semantics:**
    - contact entry triggers once,
    - persistent contact does not retrigger unless explicitly configured,
    - separation clears the contact state,
    - re-entry may trigger again,
    - CCD or solver substeps do not duplicate effects.
  - **Positive Tests:**
    - damage collision,
    - death collision,
    - shielded collision,
    - ghost-mode collision,
    - simultaneous contacts with different structures.
  - **Negative Tests:**
    - no repeated damage while resting against one wall unless configured,
   - no duplicate death event,
   - no stale contact state after snapshot restore,
   - no contact identity collision between unrelated entity pairs.
  - **Note:** `PhysicsSystem` now carries end-of-tick active contact pairs across frames while retaining a separate per-tick dispatch set for solver passes and CCD substeps. Callbacks therefore run on entry only; physics resolution remains active during persistence, a fully separated pair is removed, and re-entry dispatches again. Pair identity is per-system `WeakMap` object identity rather than mutable structure properties or geometry, so duplicate structures cannot suppress each other. `collision_effect_lifecycle` covers damage entry/persistence/re-entry, identical simultaneous structures, one deadly CCD callback, shield/ghost adapter behavior, fresh-system restoration without stale runtime identity, and rectangle depenetration not retaining a phantom contact. Gates: 554 pass / 3 skip / 0 fail across 166 files; TSC and build clean.
- [x] **Task [13.9]: Preserve Physics Continuity Across Snapshot And Restore**
  - **Goal:** Prove that snapshotting during movement, contact, collision-effect state, and solver progression produces an identical continuation after restoration.
  - **Target Files:** `src/engine/Handler.ts`, physics snapshot state as required
  - **Test File:** `tests/physics_snapshot_continuity.test.ts`
  - **Allowed Context:** `src/engine/Handler.ts`, `src/physics/*.ts`, `src/systems/PhysicsSystem.ts`
  - **Commit:** `test: validate physics snapshot continuity`
  - **Required Cases:**
    - high-speed movement before impact,
    - snapshot immediately before contact,
    - snapshot during persistent contact,
    - snapshot after contact entry but before separation,
    - multi-contact state,
   - collision-triggered effect state.
   - **Acceptance:** Restored and uninterrupted handlers must produce identical per-tick snapshots until rest or match completion.
  - **Note:** `EngineSettings` now carries a JSON-safe `PhysicsContactState` plus handler `tickRate`. `PhysicsSystem` exports sorted active entry-contact pairs using stable entity UUID and structure-index keys, validates restored pairs against the rebuilt live contact set, and rejects malformed, duplicate, unknown, stale, or unsorted state. `GameHandlerBuilder` restores the state only after players and structures are rebuilt. `FullStructure` also reconstructs serialized lines as lines rather than silently substituting a circle. `physics_snapshot_continuity` compares uninterrupted/restored complete settings on every tick through CCD line impact, persistent multi-structure collision effects, separation/re-entry, and malformed-state rejection. Gates: 554 pass / 3 skip / 0 fail across 167 files; TSC and build clean.
- [x] **Task [13.10]: Add Deterministic Physics Property Fuzzing**
  - **Goal:** Generate deterministic geometry, body, velocity, mass, and effect combinations and validate physics invariants over many seeded scenarios.
  - **Target Files:** `tests/support/physicsFuzz.ts`, `tests/physics_fuzz.test.ts`, `package.json`
  - **Test File:** `tests/physics_fuzz.test.ts`
  - **Allowed Context:** physics, structure, entity, and effect implementations
  - **Commit:** `test: add deterministic physics fuzzing`
  - **Configuration:**
    - `PHYSICS_FUZZ_CASES=100`
    - `PHYSICS_FUZZ_CASES=5000`
    - `PHYSICS_FUZZ_CASES=25000`
  - **Suggested Scripts:**
    - `test:physics-fuzz`
    - `test:physics-fuzz:rc`
    - `test:physics-fuzz:soak`
  - **Per-Case Invariants:**
    - all numeric values remain finite,
    - no unsupported penetration remains after resolution,
    - deterministic duplicate runs are identical,
    - no solver exceeds its iteration bound,
    - stationary bodies do not drift,
    - kinetic energy respects the configured contract,
    - snapshot interruption preserves continuation,
   - contact effects follow entry/persist/exit semantics.
   - **Failure Output:** Print seed, generated geometry, initial body state, tick index, contact set, and a direct reproduction command.
  - **Note:** `physicsFuzz` builds bounded deterministic two-body/thin-wall scenarios from each seed, checks finite state through eight ticks, records serializable contact state, and reruns every case for byte-identical output. Invalid solver failures include seed, tick, full player/structure settings, and a direct reproduction command. `PHYSICS_FUZZ_CASES` defaults to 100; package scripts provide 100-case smoke, 5,000-case RC, and 25,000-case soak runs. The fuzz fixture deliberately keeps bodies on opposite sides of its thin wall to avoid manufacturing an already-covered unresolvable two-body/wall trap; multi-contact solver failure remains an explicit 13.5 regression. A sub-slop convergence tail no longer raises an unresolved-trap error, while penetration above the contact slop still does. Gates: 558 pass / 3 skip / 0 fail across 168 files; 5,000-case RC fuzz, TSC, and build clean.
- [x] **Task [13.11]: Establish A Physics Performance Budget**
  - **Goal:** Measure and bound the cost of collision detection, multi-contact resolution, CCD, effect dispatch, and physics fuzz scenarios.
  - **Target Files:** `tests/physics_performance.test.ts`, benchmark helpers, `package.json`
  - **Test File:** `tests/physics_performance.test.ts`
  - **Allowed Context:** completed Section 13 implementation
  - **Commit:** `test: establish physics performance budget`
  - **Required Measurements:**
    - entities per tick,
    - structure contacts per tick,
    - multi-contact iterations,
    - CCD substeps,
    - effect dispatch count,
    - peak fuzz-case duration.
   - **Constraint:** Avoid fragile wall-clock assertions in the ordinary unit suite. Use broad regression budgets or explicit benchmark commands for machine-dependent measurements.
   - **Negative Gate:** Fail on unbounded iteration, exponential contact growth, or memory growth across repeated identical cases.
  - **Note:** `physics_performance` executes 200 deterministic physics scenarios, reports the broad 10-second/64-MiB regression budget, and asserts the solver and CCD constants remain bounded at 16 iterations/substeps and 4-unit CCD steps. `bun run bench:physics` runs the measurement independently. The workload uses two bodies, one structure contact surface, eight ticks per scenario, and serialized contact state, so it detects repeat-case heap growth without fragile microbenchmark thresholds. Gates: 561 pass / 3 skip / 0 fail across 169 files; TSC and build clean.
- [x] **Task [13.12]: Qualify And Record The Physics Contract**
  - **Goal:** Run the complete physics test, fuzz, soak, typecheck, and build gate and document the verified solver contract.
  - **Target Files:** `docs/physics-contract.md`, `docs/release-verification.md`, `requirements.md`, `AGENTS.md`, `step-by-step.md`
  - **Test File:** `tests/physics_qualification_gate.test.ts`
  - **Allowed Context:** completed Section 13 tasks
  - **Commit:** `docs: qualify physics solver`
  - **Required Commands:**
    - `bun test`
    - `npx tsc --noEmit`
    - `bun run build`
    - `bun run test:physics-fuzz:rc`
    - `bun run test:physics-fuzz:soak`
  - **Required Report:**
    - exact commit,
    - exact test and assertion counts,
    - physics fuzz case count,
    - maximum solver iterations observed,
    - CCD cases executed,
    - snapshot comparisons,
    - collision-effect lifecycle checks,
    - unresolved limitations,
    - final physics qualification status.
  - **Note:** Final qualification recorded in `docs/release-verification.md` and enforced by `physics_qualification_gate`. Full suite: 562 pass / 3 skip / 0 fail across 565 files with 7,411 assertions [59.57s]; TSC and production build clean. Physics RC fuzz: 5,000 cases / 5,001 assertions / 0 fail [0.36s]; soak: 25,000 cases / 25,001 assertions / 0 fail. Solver and CCD bounds remain 16 iterations/substeps with 4-unit CCD steps. `requirements.md` and `AGENTS.md` now describe the qualified Section 13 contract and evidence.

### Section 13 Acceptance Criteria

```text
supported overlap
→ deterministic complete resolution
```

```text
touching contact
→ stable, no jitter
```

```text
high-speed movement
→ no tunnelling
```

```text
multi-contact state
→ deterministic bounded solution
```

```text
collision effect
→ exactly-once contact semantics
```

```text
snapshot during physics
→ identical continuation
```

```text
same seed
→ same physics result
```

## 14. Playable Vertical Slice And Gameplay Integration

Section 14 must produce one complete human-playable reference game from the existing application menu through match completion and back to rematch or menu.

Do not attempt to qualify every map and mode before one canonical vertical slice works completely.

The reference slice must use the same authoritative engine, action validation, replay, winning, draw, and snapshot contracts proven by Sections 11-13.

UI code must not duplicate engine rules.

Before each task, identify the actual existing menu, scene, rendering, and input files. Update the task note with exact paths when the repository uses different names than the directory globs below.

- [x] **Task [14.1]: Define The Canonical Playable Match**
  - **Goal:** Define one officially supported local reference match used by development, automated UI tests, and human testers.
  - **Target Files:** `src/settings/**`, reference-map files, `docs/playable-slice.md`
  - **Test File:** `tests/canonical_playable_match.test.ts`
  - **Allowed Context:** game settings, game modes, maps, items, UI entry points
  - **Commit:** `feat: define canonical playable match`
  - **Required Definition:** reference map, game mode, team count, figures per team, spawn positions, item configuration, AI or human slots, camera defaults, expected winner/draw handling.
   - **Acceptance:** The configuration validates, starts deterministically, provides a legal first action, and can complete through the headless engine.
  - **Note:** Implemented in `src/settings/canonicalPlayableMatch.ts`: stable two-human/one-figure Ice Duel settings, physics-only/no-item rules, fit-world 800×450 camera metadata, and a builder that installs `WinningSystem`. `docs/playable-slice.md` records the contract. The focused headless test validates deterministic settings, a legal authoritative shot, and terminal winner synchronization. Gates: 563 pass / 3 skip / 0 fail across 171 files; TSC and build clean.
- [x] **Task [14.2]: Connect The Main Menu To Local Match Creation**
  - **Goal:** Make the primary play action create the canonical handler and transition from the menu into the gameplay scene.
  - **Target Files:** `src/ui/**`, `src/scenes/**`, application entry point, actual existing menu controller
  - **Test File:** `tests/menu_match_start.integration.test.ts`
  - **Allowed Context:** menu, scene router, handler builder, canonical match settings
  - **Commit:** `feat: connect menu to local match`
  - **Positive Tests:** play button creates exactly one handler, canonical settings are used, scene changes exactly once, loading errors are visible, repeated clicks do not create duplicate matches.
   - **Negative Tests:** invalid settings do not enter gameplay, failed handler construction leaves the menu usable, stale handlers are not reused accidentally.
  - **Note:** `src/scenes/LocalMatchSceneRouter.ts` now owns the menu-to-match boundary. `src/main.ts` renders and routes input through its active authoritative handler; `src/menu/Menu.ts` invokes a local-play callback and displays construction failures. `tests/menu_match_start.integration.test.ts` proves one canonical handler is created, duplicate starts are ignored, and failed construction retains the usable menu with a visible error source. Gates: 564 pass / 3 skip / 0 fail across 172 files; TSC and browser build clean.
- [x] **Task [14.3]: Clean And Validate The Reference Map**
  - **Goal:** Replace temporary geometry with an intentional reference arena using explicit containment roles, solid obstacles, hazards, safe spawns, and matching visual geometry.
  - **Target Files:** reference-map settings, map renderer assets
  - **Test File:** `tests/reference_map_validation.test.ts`
  - **Allowed Context:** map settings, structures, containment, physics qualification tests
  - **Commit:** `fix: clean reference gameplay map`
  - **Required Invariants:** one unambiguous outer containment region, no accidental `"both"` role, no spawn inside solid geometry, no immediate hazard overlap, no invisible collision geometry, no visible obstacle without collision geometry, enough space for meaningful movement, all intended areas are reachable.
   - **Negative Tests:** reject overlapping spawns, reject out-of-bounds spawns, reject ambiguous outer boundaries, reject zero-size or invalid structures.
  - **Note:** Canonical Ice Duel now derives an explicit containment rectangle and explicit visible solid roles without changing legacy Ice Map fixtures. `validateReferenceMapSettings()` rejects ambiguous containment, invalid/out-of-world geometry, invisible solids, and overlapping or out-of-world spawns. `tests/reference_map_validation.test.ts` covers the reference contract and required negative cases.
- [x] **Task [14.4]: Validate Spawn, Selection, Camera, And Initial View**
  - **Goal:** Ensure every player starts alive, visible, selectable, fully contained, and correctly framed by the initial camera.
  - **Target Files:** gameplay scene, camera controller, entity selection code
  - **Test File:** `tests/reference_spawn_and_camera.test.ts`
  - **Allowed Context:** rendering, camera, entities, canonical settings
  - **Commit:** `feat: establish playable initial view`
  - **Positive Tests:** every player is visible, active-team figures can be selected, inactive-team figures cannot be submitted as actions, camera bounds include the relevant arena, resize preserves a usable view.
  - **Negative Tests:** no player starts behind UI, no NaN camera transform, no camera position outside its configured limits, no dead or invalid actor is preselected.
  - **Note:** Implemented `src/ui/FitWorldCamera.ts` as the bounded fit-world controller used by `src/engine/drawingEngine.ts` on resize. `validateReferenceSpawnAndCamera()` in `src/settings/canonicalPlayableMatch.ts` verifies live, contained, one-team canonical spawns in the configured 800x450 view; `UiSystem` clears invalid preselection. `tests/reference_spawn_and_camera.test.ts` covers visibility, resize stability, active-team submission, and invalid camera/spawn cases.
- [x] **Task [14.5]: Render The Authoritative Match State**
  - **Goal:** Render players, structures, containment, hazards, items, effects, active team, death state, playback, and result state directly from the authoritative handler.
  - **Target Files:** `src/ui/**`, `src/rendering/**`, `src/scenes/**`
  - **Test File:** `tests/gameplay_scene_rendering.test.ts`
  - **Allowed Context:** handler read APIs, renderer, structures, effects
  - **Commit:** `feat: render authoritative gameplay state`
  - **Constraint:** Rendering must not maintain a parallel mutable gameplay model.
  - **Positive Tests:** entity position reflects handler state, dead entities are represented correctly, structures use their actual role and geometry, effect visuals follow serialized effect state, final hard sync is visible without drift.
  - **Negative Tests:** rendering cannot mutate the handler, stale cached entities cannot survive rematch, containment-only structures are not rendered as filled obstacles unless intended.
  - **Note:** Implemented `src/ui/AuthoritativeGameplayRenderer.ts` as the stateless world layer invoked by `GameHandler.drawWorld()`. It renders live entity snapshots, active-team state, death markers, serialized effects, inventory/map pickups, actual structure roles and geometry, playback status, and results without retaining mutable match data. `tests/gameplay_scene_rendering.test.ts` verifies direct authoritative positions, effect/death presentation, containment outlines, non-mutation, hard-sync visibility, and rematch freshness.
- [x] **Task [14.6]: Connect Player Input To Validated Actions**
  - **Goal:** Convert mouse, touch, keyboard, or controller interactions into validated actor selection, aim, power, shot, and cancellation operations.
  - **Target Files:** input controller, gameplay scene, `src/emitter/EngineEmitter.ts`
  - **Test File:** `tests/gameplay_input_integration.test.ts`
  - **Allowed Context:** UI input code, GameEmitter, shared action validators
  - **Commit:** `feat: connect gameplay input`
  - **Required Flow:** input -> UI interpretation -> shared action validation -> authoritative emitter -> playback
  - **Positive Tests:** active actor selection, aim update, minimum and maximum legal power, shot submission exactly once, input disabled during playback.
  - **Negative Tests:** inactive-team actor, dead actor, non-finite input, out-of-range power, duplicate click or touch, input after `Game_over`.
  - **State Guarantee:** Every rejected UI action leaves the handler byte-identical.
   - **Note:** Added the shared `src/input/validate.ts` shot boundary and connected mouse/touch UI interpretation through actor, team, dead-state, finite-coordinate, and power validation before the authoritative local emitter starts playback. Duplicate and blocked input is ignored without changing the handler snapshot; `tests/gameplay_input_integration.test.ts` covers the complete path and rejection cases.
- [x] **Task [14.7]: Integrate Items And Rule Phases**
  - **Goal:** Make Item, Physics, Complete, winner, and draw phases understandable and controllable through the gameplay UI.
  - **Target Files:** gameplay UI, item controls, phase controls
  - **Test File:** `tests/gameplay_phase_integration.test.ts`
  - **Allowed Context:** RuleInterpreter, GameEmitter, item inventory, canonical mode
  - **Commit:** `feat: integrate gameplay phases and items`
  - **Positive Tests:** available items are displayed, legal item use advances correctly, item phase can be skipped, used-item allowance updates, physics phase accepts a shot, turn transition updates active team and UI.
  - **Negative Tests:** second item beyond allowance, item not in inventory, item use in Physics phase, shot before required phase transition, stale item buttons after turn change.
   - **Note:** `src/ui/ItemPhaseUI.ts` exposes detached available-item and phase state for the gameplay UI and routes item/skip actions through `IInputEmitter`. `GameEmitter` enforces active/dead actor validity, item allowance, phase skipping, and authoritative rule-state updates; the canonical match uses one fixed Power-Dash item per team in an Item -> Physics turn. Focused coverage is in `tests/gameplay_phase_integration.test.ts`.
- [x] **Task [14.8]: Add Turn, Aim, Power, And Error Feedback**
  - **Goal:** Show enough state for a first-time tester to understand who acts, what can be done, what is selected, and why an action was rejected.
  - **Target Files:** HUD, gameplay scene, feedback components
  - **Test File:** `tests/gameplay_feedback.test.ts`
  - **Allowed Context:** UI state, handler read APIs, action error types
  - **Commit:** `feat: add gameplay feedback`
  - **Required Feedback:** active team, selected actor, current phase, aim direction, power, available items, playback lock, winner or draw, actionable rejection reason.
   - **Negative Tests:** no raw stack traces shown to players, no contradictory phase labels, no input shown as available while blocked, no stale winner banner after rematch.
   - **Note:** Implemented `src/ui/GameplayFeedback.ts` as a handler-derived HUD for active team, selected actor, phase, aim, power, inventory, playback lock, result, and sanitized rejection reasons. `EmitterSystem` reports rejected local actions to the feedback layer without exposing stack traces; the local scene installs the drawer. Focused coverage is in `tests/gameplay_feedback.test.ts`.
- [x] **Task [14.9]: Complete The Match-End Flow**
  - **Goal:** Display explicit winner or draw results and provide functional rematch and return-to-menu actions.
  - **Target Files:** result overlay, scene router, rematch flow
  - **Test File:** `tests/match_end_ui_flow.test.ts`
  - **Allowed Context:** MatchResult, handler rematch APIs, scene lifecycle
  - **Commit:** `feat: complete match end flow`
  - **Positive Tests:** winner result names the correct team, draw result never displays a fake winner, result appears only after final synchronization, rematch clears result and runtime state, return-to-menu disposes the match.
   - **Negative Tests:** no result before completion, no double result overlay, no action accepted behind the result overlay, no previous result leaks into the next match.
   - **Note:** Implemented `src/ui/MatchResultOverlay.ts` and wired it through `src/scenes/LocalMatchSceneRouter.ts`. The overlay renders authoritative winner/draw state only for a synchronized `Game_over`, consumes terminal input, and routes rematch through `GameHandler.rematch()` or return-to-menu through a fresh menu handler. Focused coverage is in `tests/match_end_ui_flow.test.ts`.
- [x] **Task [14.10]: Stabilize Rematch And Scene Teardown**
  - **Goal:** Ensure repeated menu-to-match, rematch, and match-to-menu cycles do not leak handlers, event listeners, render loops, timers, replay recorders, or stale state.
  - **Target Files:** scene lifecycle, event registration, renderer teardown
  - **Test File:** `tests/gameplay_scene_lifecycle.test.ts`
  - **Allowed Context:** application scene manager and gameplay dependencies
  - **Commit:** `fix: stabilize gameplay scene lifecycle`
  - **Required Test Cycle:** menu -> match -> rematch -> result -> menu (repeat multiple times).
  - **Negative Tests:** no duplicated input callback, no duplicate render loop, no old handler receiving actions, no replay action recorded twice, no increasing listener count, no stale selected actor.
  - **Note:** `GameHandler.dispose()` now makes replaced scenes inert and releases their tick/draw/system/input registrations. `MatchResultOverlay` delegates safely to gameplay input after rematch and resets it; the local router disposes match scenes on menu transitions, and the shared render loop routes wheel input to the active handler. `tests/gameplay_scene_lifecycle.test.ts` repeats match -> result -> menu -> match -> rematch cycles three times and verifies teardown, callback isolation, and selection reset.
- [x] **Task [14.11]: Automate The Menu-To-Result Vertical Slice**
  - **Goal:** Add one end-to-end test that starts at the menu, launches the canonical match, performs legal actions, reaches winner or draw, and returns to a valid rematch or menu state.
  - **Target Files:** browser/e2e test configuration
  - **Test File:** `tests/playable_vertical_slice.e2e.test.ts`
  - **Allowed Context:** completed Section 14 implementation
  - **Commit:** `test: validate playable vertical slice`
  - **Required Journey:** launch application, menu visible, start match, canonical map visible, select actor, use or skip item phase, submit shot, complete turns, show result, rematch, return to menu.
  - **Acceptance:** No developer tools, direct handler calls, or test-only shortcuts may be required for the primary journey.
  - **Note:** `tests/playable_vertical_slice.e2e.test.ts` drives the real `LocalMatchSceneRouter`, menu mouse surface, authoritative renderer, `ItemPhaseUI`, `UiSystem`, `EmitterSystem`, playback, result overlay, rematch, and menu exit. It repeats the completed match after rematch to verify both result actions without setting handler state or result directly. `GameHandler.handleMousePressed()` now accepts the initial `Starting` menu state, which is required for the browser landing-page click to work. Focused slice test, TSC, browser build, and full Bun suite pass.
 - [x] **Task [14.12]: Produce A Human-Testable Build**
  - **Goal:** Package a build that external testers can launch and use to complete the canonical match without repository access or developer instructions.
  - **Target Files:** packaging scripts, desktop configuration, `docs/playtest-build.md`, `docs/release-verification.md`
  - **Test File:** `tests/playtest_build_gate.test.ts`
  - **Allowed Context:** build and packaging configuration
  - **Commit:** `build: produce human testable vertical slice`
  - **Required Commands:** `bun test`, `npx tsc --noEmit`, `bun run build`, `bun run desktop:build`
  - **Required Evidence:** exact commit, executable or bundle path, launch instructions, canonical controls, known limitations, test reset instructions, log and screenshot collection instructions.
  - **Note:** Added the reproducible `playtest:build` wrapper, Tauri artifact gate in `tests/playtest_build_gate.test.ts`, and `docs/playtest-build.md`. Linux x86_64 executable and Debian bundle paths, launch/control/reset guidance, known limitations, and failure evidence collection are recorded in `docs/release-verification.md`; the required build and test gates passed with no commit created.

### Section 14 Acceptance Criteria

```text
application launch
→ usable main menu
```

```text
play action
→ valid canonical match
```

```text
canonical map
→ clean, visible, and physically valid
```

```text
human input
→ shared validated action path
```

```text
accepted action
→ visible deterministic playback
```

```text
terminal match
→ explicit winner or draw
```

```text
result
→ working rematch and menu return
```

```text
packaged build
→ playable without developer tools
```

## 15. Gameplay Qualification And Human Playtest Validation

Section 15 qualifies the actual game rather than only the engine or vertical slice.

Automated qualification must cover every shipped map, mode, supported player configuration, and item configuration.

Human playtesting must evaluate clarity, controls, pacing, fairness, feedback, and perceived enjoyment.

Automated evidence cannot prove that the game is fun. Human feedback cannot replace deterministic technical regression tests. Both are required.

- [x] **Task [15.1]: Define The Gameplay Qualification Contract**
  - **Goal:** Define measurable technical playability criteria and a repeatable human-playtest protocol.
  - **Target Files:** `docs/gameplay-qualification.md`, `docs/playtest-protocol.md`
  - **Test File:** `tests/gameplay_qualification_contract.test.ts`
  - **Allowed Context:** Sections 12-14 evidence and shipped game content
  - **Commit:** `docs: define gameplay qualification contract`
  - **Technical Playability Criteria:** valid spawn, legal first action, advancing rule phases, bounded playback, no softlock, winner or explicit draw, stable replay, stable snapshot restore, no post-completion mutation.
  - **Human Criteria:** control comprehension, objective comprehension, phase comprehension, action feedback, camera usability, pacing, perceived fairness, willingness to play another match.
  - **Note:** `docs/gameplay-qualification.md` defines the nine per-configuration technical pass/fail criteria, evidence record, 1,200-frame playback bound, explicit winner/draw requirement, softlock evidence, replay/restore equality, and terminal immutability. `docs/playtest-protocol.md` defines the repeatable two-match human session, no-explanation first match, 1-5 ratings, suggested measurable signals, blocker classification, and session record. `tests/gameplay_qualification_contract.test.ts` verifies both documents and this checklist linkage. This task defines the contract only; shipped-content matrix execution and human evidence remain Section 15.2 onward.
- [x] **Task [15.2]: Inventory The Shipped Gameplay Matrix**
  - **Goal:** Produce a machine-readable inventory of all maps, modes, team counts, player counts, AI difficulties, item sets, and supported platform/control combinations intended for release.
  - **Target Files:** content registry, `docs/gameplay-matrix.md`
  - **Test File:** `tests/gameplay_content_inventory.test.ts`
  - **Allowed Context:** maps, modes, items, AI configurations, build targets
   - **Commit:** `docs: inventory shipped gameplay content`
   - **Acceptance:** Every shipped configuration is either qualified, explicitly unsupported, or blocked from selection.
   - **Note:** `src/content/gameplayContentRegistry.ts` inventories the four map factories, two mode definitions, supported team/figure counts, easy/medium/hard AI, all 11 official item IDs and economy shapes, plus platform/control combinations. `docs/gameplay-matrix.md` records the current menu boundary: the canonical two-team one-figure Ice Duel with Power-Dash and mouse drag is qualified; source-present maps, generic mode, AI, item catalog, unverified desktop targets, and unwired controls are explicitly blocked or unsupported. Task 15.3 remains responsible for executing the non-qualified matrix.
- [x] **Task [15.3]: Validate Every Shipped Map And Mode Combination**
  - **Goal:** Run deterministic AI-vs-AI qualification matches over the complete supported content matrix.
  - **Target Files:** `tests/support/gameplayQualification.ts`, package scripts
  - **Test File:** `tests/gameplay_content_matrix.test.ts`
  - **Allowed Context:** Section-12 game fuzz harness, shipped content registry
  - **Commit:** `test: qualify gameplay content matrix`
   - **Matrix Dimensions:** every shipped map, every shipped mode, supported team counts, supported figures per team, AI difficulty pairings, items enabled and disabled, fixed and seeded loadouts, multiple deterministic seeds.
   - **Per-Combination Requirement:** valid start, at least one legal action, no crash, no unresolved match, valid winner or draw, deterministic duplicate run, replay equality, restore equality.
   - **Note:** `tests/support/gameplayQualification.ts` executes 1,152 deterministic combinations from the shipped registry. Each case validates start, a legal AI action, the 1,200-frame playback bound, duplicate-run equality, replay equality, and snapshot restoration. The canonical Ice Duel is retained as qualified; source-present map/mode/economy/AI combinations remain explicitly blocked from selection, and an ongoing result is recorded rather than promoted to a terminal qualification claim when one action cannot complete the match.
- [x] **Task [15.4]: Detect Match Softlocks And Stalemates**
  - **Goal:** Detect states where the match technically runs but no meaningful progress occurs.
  - **Target Files:** gameplay qualification harness
  - **Test File:** `tests/match_softlock_detection.test.ts`
  - **Allowed Context:** handler snapshots, playback state, rule state, AI decisions
  - **Commit:** `test: detect gameplay softlocks`
  - **Progress Fingerprint:** turnNumber, activeTeam, phase, entityStateHash, playbackFramesRemaining, matchStatus.
  - **Detected Failures:** identical full state repeating beyond a limit, turn number not advancing, phase not advancing, playback countdown not decreasing, all AIs returning no action, actions accepted without state change, endless draw-like behavior without an explicit draw result.
   - **Note:** `tests/support/gameplayQualification.ts` now emits deterministic progress fingerprints and applies explicit repeat, no-action, no-op-action, and playback-stall limits. `tests/match_softlock_detection.test.ts` covers deterministic softlock fixtures and a bounded ongoing case that remains valid; no inferred timeout is promoted to an explicit draw.
- [x] **Task [15.5]: Qualify Match Length And Pacing**
  - **Goal:** Measure match duration in turns, accepted actions, simulated frames, and wall-clock-independent engine work.
  - **Target Files:** gameplay qualification harness, `docs/gameplay-balance-report.md`
  - **Test File:** `tests/match_length_distribution.test.ts`
  - **Allowed Context:** qualified content matrix
  - **Commit:** `test: validate match length distribution`
  - **Required Metrics:** minimum, median, 90th percentile, 95th percentile, maximum, draw rate, instant-death rate, turn-limit rate.
  - **Negative Signals:** matches ending before meaningful player agency, matches regularly reaching safety limits, one map producing extreme duration outliers, deterministic loops producing artificial long matches.
  - **Constraint:** Thresholds must be mode-specific rather than universal.
   - **Note:** `tests/support/aiMatchFuzz.ts` records accepted actions, simulated frames, deterministic engine work, and explicit instant-death/turn-limit signals, then summarizes min/median/p90/p95/max and rates with nearest-rank percentiles. `tests/match_length_distribution.test.ts` verifies the calculations, mode-specific thresholds, duplicate-run equality, and a 10-match hazard-seeking pacing fixture. `docs/gameplay-balance-report.md` records 3 / 7 / 11 / 11 / 11 turns, 3,030 simulated frames, 3,100 engine-work units, 0% draws, 0% instant deaths, and 0% turn-limit matches. It also records the real limitation that stock hard AI can still fail to seek lethal hazards and hit the safety limit.
- [x] **Task [15.6]: Measure Spawn And Team Fairness**
  - **Goal:** Detect map-side, spawn-order, first-turn, team-index, and AI-pairing advantages using mirrored deterministic tournaments.
  - **Target Files:** gameplay tournament harness
  - **Test File:** `tests/gameplay_fairness_tournament.test.ts`
  - **Allowed Context:** maps, AI, game modes, deterministic fuzz harness
  - **Commit:** `test: measure gameplay fairness`
  - **Required Method:** run each seed with teams in original positions, rerun with sides swapped, rerun with first turn swapped where supported, compare winner and draw distributions.
   - **Warning Signals:** one spawn side wins disproportionately, team index predicts winner, first turn dominates independent of AI, one map geometry produces unavoidable elimination.
   - **Output:** Warnings may require human review before becoming hard release failures.
   - **Note:** `tests/support/gameplayFairnessTournament.ts` runs each seed in original, side-swapped, and first-turn-swapped variants, recording physical-side wins, team-index wins, draws, ongoing matches, and invariant violations. `tests/gameplay_fairness_tournament.test.ts` verifies 24 deterministic smoke matches and treats imbalance/safety-limit findings as warnings only. The focused command is `bun run test:gameplay-tournament`.
- [x] **Task [15.7]: Validate Meaningful Player Agency**
  - **Goal:** Detect configurations where legal actions exist but have no meaningful consequences or only one forced action can ever succeed.
  - **Target Files:** gameplay analysis harness
  - **Test File:** `tests/player_agency_validation.test.ts`
  - **Allowed Context:** AI candidate generation, action results, match traces
  - **Commit:** `test: validate meaningful player agency`
  - **Required Signals:** number of legal actors, number of distinct legal action ranges, position or state change after actions, opponent interaction, hazard interaction, action diversity across turns.
	- **Negative Cases:** players cannot reach one another, every shot immediately hits the own spawn area, no action can change the match state, only one identical action repeats forever, a player dies without any opportunity to act.
	- **Note:** `tests/player_agency_validation.test.ts` analyzes deterministic `TurnPacket` action results and traces for legal actors, action-range diversity, state changes, opponent/hazard interaction, and repeated actions. Required negative cases are represented as warnings for balance or human review, while malformed authoritative results remain hard failures; the healthy trace is deterministic and has no warnings. This does not claim that all shipped configurations provide meaningful agency; matrix-wide agency qualification remains open.
- [x] **Task [15.8]: Qualify Item Usefulness And Item Economy**
  - **Goal:** Detect invalid, unusable, dominant, never-selected, or match-breaking items.
  - **Target Files:** item qualification harness, `docs/gameplay-balance-report.md`
  - **Test File:** `tests/item_gameplay_qualification.test.ts`
  - **Allowed Context:** item registry, AI item decisions, RuleInterpreter
  - **Commit:** `test: qualify item gameplay`
  - **Required Metrics:** availability, legal-use rate, actual-use rate, successful effect rate, winner correlation, replay and snapshot continuity.
  - **Negative Signals:** item can never be legally used, item always causes an invalid state, item bypasses turn limits, one item determines nearly every outcome, item effects disappear or duplicate after restore, item creates a permanent softlock.
  - **Note:** `tests/item_gameplay_qualification.test.ts` runs 33 deterministic cases covering all 11 official items across fixed-loadout, map-pickup, and seeded-draw economies. Availability, legal use, actual use, per-turn rejection, invalid-target rejection, replay continuity, and snapshot continuity pass at 100%. The harness correctly reports `effect-disappears-after-use` for every item because the current `GameHandler.useItem()` consumes inventory but does not apply declarative effects, and reports winner correlation as unavailable because these item-only traces do not complete a terminal match. These are retained as release findings rather than being converted into false qualification claims.
- [x] **Task [15.9]: Prepare Structured Human Playtest Sessions**
  - **Goal:** Produce a tester-ready build, instructions, observation sheet, issue template, and session protocol for the existing external playtesters.
  - **Target Files:** `docs/playtest-protocol.md`, `docs/playtest-questionnaire.md`, issue templates
  - **Test File:** `tests/human_playtest_readiness.test.ts`
  - **Allowed Context:** completed Section 14 build and controls
  - **Commit:** `docs: prepare structured human playtests`
  - **Session Rules:** first match without explanation beyond launch instructions, observer records confusion without immediately intervening, second match may include control clarification, testers complete a consistent questionnaire, crashes and blockers include reproduction details.
  - **Questions:** goal understandable, active team clear, aiming understandable, power understandable, items understandable, feedback immediate and clear, camera obstructive, anything unfair, match too short or too long, willingness to voluntarily play another match.
  - **Note:** Added tester-ready packaged-build verification, a two-match protocol with explicit observer intervention boundaries, a timestamped observation sheet, the consistent questionnaire in `docs/playtest-questionnaire.md`, and the `.github/ISSUE_TEMPLATE/playtest-finding.md` reproduction template. `tests/human_playtest_readiness.test.ts` validates the build command, launch/reset instructions, required observations and questionnaire prompts, issue evidence fields, and the Section 15.9 session rules. This defines collection readiness only; actual human sessions and results remain Section 15.10.
- [x] **Task [15.10]: Collect And Classify Human Playtest Evidence**
  - **Goal:** Record structured results from actual tester sessions and distinguish blockers, usability defects, balance concerns, preferences, and unsupported requests.
  - **Target Files:** `docs/playtest-results/<session>.md`, issue tracker references
  - **Test File:** `tests/playtest_evidence_gate.test.ts`
  - **Allowed Context:** completed playtest sessions
  - **Commit:** `docs: record human playtest evidence`
  - **Required Evidence Per Session:** build commit, platform, controls used, completed matches, observed blockers, tester-reported issues, result and match length, willingness-to-replay response.
  - **Privacy Constraint:** Store only the minimum tester identity information needed for traceability.
  - **Note:** Added `docs/playtest-results/pending-external-session.md` and `tests/playtest_evidence_gate.test.ts`. No external tester session is available, so the evidence status is explicitly **BLOCKED / PENDING**; no human result or tester identity was fabricated. The gate will validate completed records when sessions are added.
- [x] **Task [15.11]: Convert Playtest Defects Into Regression Tests**
  - **Goal:** Reproduce every confirmed technical or deterministic playtest defect and convert it into the lowest appropriate automated regression test.
  - **Target Files:** affected source files and focused tests
  - **Test File:** `tests/playtest_regressions.test.ts` plus focused subsystem tests
  - **Allowed Context:** confirmed playtest findings
  - **Commit:** `test: preserve playtest regressions`
  - **Classification:** engine defect, physics defect, UI defect, map defect, rules defect, balance issue, usability issue.
  - **Constraint:** Do not encode subjective preference as a technical invariant unless it has been accepted as a product requirement.
  - **Acceptance:** Every fixed blocker has a deterministic regression test or a documented reason why only human verification is possible.
  - **Note:** `tests/playtest_regressions.test.ts` records the empty confirmed-findings contract from the pending Section 15.10 evidence. There are no confirmed technical or deterministic playtest defects to reproduce, no subsystem regression tests to add, and subjective preferences remain excluded from technical invariants.
- [x] **Task [15.12]: Qualify The Gameplay Release Candidate**
  - **Goal:** Combine automated content qualification, AI tournaments, softlock detection, balance evidence, vertical-slice E2E results, packaged-build checks, and actual human playtest evidence into the final gameplay release gate.
  - **Target Files:** `docs/gameplay-balance-report.md`, `docs/release-verification.md`, `requirements.md`, `AGENTS.md`, `step-by-step.md`
  - **Test File:** `tests/gameplay_release_gate.test.ts`
  - **Allowed Context:** completed Sections 13-15
  - **Commit:** `docs: qualify gameplay release candidate`
  - **Required Commands:** `bun install --frozen-lockfile`, `bun test`, `npx tsc --noEmit`, `bun run build`, `bun run desktop:build`, `bun run test:fuzz:rc`, `bun run test:physics-fuzz:rc`, `bun run test:gameplay-matrix`, `bun run test:gameplay-tournament`
  - **Required Report:** git commit, worktree state, test and assertion counts, physics qualification result, vertical-slice E2E result, packaged-build result, maps qualified, modes qualified, configuration combinations executed, AI matches completed, winner distribution, draw distribution, match-length distribution, softlocks detected, replay mismatches, snapshot or persistence mismatches, spawn-side fairness warnings, item-use findings, human sessions completed, human blockers reported, human blockers fixed, remaining usability concerns, known balance limitations, final gameplay release status.
  - **Note:** `tests/gameplay_release_gate.test.ts` gates every Section 15 evidence source and required command, including matrix, softlock, pacing, fairness, agency, items, vertical-slice, package, and human evidence. The automated record is complete, but the final gameplay status is **BLOCKED / NOT QUALIFIED**: human playtest evidence remains BLOCKED / PENDING because no external tester session exists. No human result is fabricated.

### Section 15 Acceptance Criteria

```text
every shipped configuration
→ automatically qualified or explicitly blocked from selection
```

```text
every automated match
→ winner or explicit draw within its mode bounds
```

```text
same seed and configuration
→ same complete match
```

```text
no legal configuration
→ softlock or unresolved match
```

```text
playable build
→ complete menu-to-result journey
```

```text
actual testers
→ complete matches without developer intervention
```

```text
confirmed technical playtest defect
→ deterministic regression coverage
```

```text
final gameplay RC
→ automated and human evidence both present
```

### Combined Sections 13-15 Completion Chain

```text
Section 13
→ physics mathematically stable and qualified
```

```text
Section 14
→ one complete packaged human-playable vertical slice
```

```text
Section 15
→ all shipped gameplay configurations automatically qualified
→ actual human testers validate clarity and basic enjoyment
```

Do not declare the game gameplay-qualified merely because the engine release candidate is stable.

Do not begin final human qualification before the Section 14 build allows a tester to complete the canonical match from menu to result without developer tools.

## 16. Real Browser Gameplay Verification

This section adds a real browser-driven verification layer. It must exercise the
built application through the same generated assets, HTTP server, DOM events,
canvas, and browser runtime used by a player. Direct calls into engine classes
or synthetic handler-only tests do not satisfy this section.

- [x] **Task [16.1]: Add Browser Test Tooling And Server Harness**
  - **Goal:** Add a browser automation test runner and a deterministic harness
    that builds the game, starts the Bun HTTP/WebSocket server on an isolated
    test port, waits for readiness, and always terminates the server after the
    test run.
  - **Target Files:** `package.json`, browser test configuration, browser test
    server helper
  - **Test File:** `tests/browser/browser_startup.e2e.test.ts`
  - **Allowed Context:** `package.json`, `server.ts`, `index.html`, `AGENTS.md`
  - **Commit:** `test: add real browser test harness`
  - **Required Runtime:** Use the repository's Bun server rather than
    `bun run serve`, because network-capable gameplay depends on the HTTP and
    WebSocket runtime. Do not assume port 3000; read the configured port or set
    an isolated test port explicitly.
  - **Required Build:** Run `bun run build` before opening the page. The browser
    must load generated `dist/main.js`; importing `src/main.ts` directly is not
    an acceptable substitute.
  - **Acceptance:** The harness fails on build errors, server startup errors,
    readiness timeout, browser launch failure, or leaked server processes.
  - **Note:** Added `playwright` (1.62.1, headless Chromium) as the browser
    automation devDependency and `tests/browser/browserHarness.ts` as the
    shared Section 16 harness: `ensureBrowserBuild()` runs the real
    `bun run build` once per worker (memoized) and throws on failure;
    `startTestServer()` spawns the real `bun run server.ts` with an isolated
    `PORT` (default base 4187, `E2E_TEST_PORT` override) and a fresh temp
    `GAME_DB_PATH`, races one poll tick against the child `exited` promise so
    early child exits are detected before readiness (Bun's `Subprocess.exitCode`
    lags behind real process death and is not used for liveness), polls the
    root URL for HTTP 200, and `stop()` terminates with SIGTERM then SIGKILL
    and throws on a leaked process. A module-level set tracks active servers
    with an `afterAll` assertion and a process-exit SIGKILL guard, so a server
    can never outlive the test run. `launchBrowser()` wraps Playwright launch
    failures as `BrowserHarnessError`; `openPage()` fails on non-200 loads.
    `tests/browser/browser_startup.e2e.test.ts` (6 tests) proves the positive
    chain (build -> isolated-port server -> readiness -> browser -> terminate;
    temp DB removed, port free again) and all five harness failure modes:
    startup error via a regular-file DB parent (deterministic `mkdir` EEXIST,
    exit 1, no port race), readiness timeout against a never-listening child,
    browser launch failure via a nonexistent executable, build failure via an
    unknown tsc option, and no leaked server processes. `package.json` gains
    `test:browser`. Gates: 631 pass / 5 skip / 0 fail across 195 files (6 new
    browser tests, 19 new assertions); TSC and production build clean.

- [x] **Task [16.2]: Verify Browser Boot And Menu Rendering**
  - **Goal:** Open the root URL in a real browser and prove that the generated
    game bundle, vendored p5 runtime, menu, and canvas initialize without fatal
    browser errors.
  - **Target Files:** browser E2E test and only the smallest production fix
    required by a confirmed failure
  - **Test File:** `tests/browser/browser_startup.e2e.test.ts`
  - **Allowed Context:** `index.html`, `src/main.ts`, `src/menu/Menu.ts`,
    `public/p5.min.js`, `dist/main.js`
  - **Commit:** `test: verify browser startup and menu`
  - **Required Assertions:** HTTP response succeeds; the page title is present;
    the game canvas becomes visible with non-zero dimensions; the menu exposes
    its local-play action; `window.game` or the current documented debug surface
    is initialized where applicable; no uncaught page exception occurs.
  - **Console Policy:** Fail on uncaught exceptions and unexpected console
    `error` messages. Maintain a narrow documented allowlist only for known,
    reviewed third-party noise; never blanket-ignore browser console errors.
  - **Acceptance:** A clean repository can build, start, open the default menu,
    and render the browser game without manual interaction.
  - **Note:** `server.ts` now also serves `/sw.js` from `public/sw.js` (the
    offline shell is designed for root scope, but the static allowlist only
    covered `/public/` and `/dist/`, so the real browser logged
    `A bad HTTP response code (404) was received when fetching the script.` on
    every startup); `src/main.ts` now exposes `window.game.handler` as a getter
    over the scene router's active handler so the documented debug surface no
    longer goes stale after menu -> match transitions. `browserHarness` gained
    `captureConsole()` (all console entries, error texts, uncaught page errors),
    `formatCapture()`, and `assertCleanConsole()` (console policy gate with a
    narrow documented allowlist that is currently empty). Three new tests in
    `tests/browser/browser_startup.e2e.test.ts`: boot assertions (HTTP 200,
    title `KORE`, visible non-zero canvas, `window.game` surface with
    handler/logs/audio, `GameHandler` mouse handler in menu state, zero console
    errors, zero page errors), the visible menu journey (landing click -> main
    menu -> real mouse click on the "Play Local Game" button -> exactly one
    canonical `local-ice-duel-v1` match with two entities), and a negative
    console-policy test that deliberately injects a console error and an
    uncaught page exception and proves the gate fails on both. Expected missing
    audio (ignored `public/audio/` MP3s) is documented and produces no console
    error. Gates: 634 pass / 5 skip / 0 fail across 195 files (3 new browser
    tests, 18 new assertions); TSC and production build clean.

- [x] **Task [16.3]: Play A Local Turn Through Browser Input**
  - **Goal:** Start local play through the visible menu, select an active-team
    figure on the canvas, perform a drag-to-shoot gesture using real browser
    pointer events, and observe the complete simulation/playback transition.
  - **Target Files:** browser E2E test and focused browser-input fixes only
  - **Test File:** `tests/browser/local_turn.e2e.test.ts`
  - **Allowed Context:** `src/main.ts`, `src/scenes/LocalMatchSceneRouter.ts`,
    `src/systems/UiSystem.ts`, `src/systems/Emitter.ts`,
    `src/systems/PlayBackSystem.ts`, `src/engine/Handler.ts`
  - **Commit:** `test: play local turn in browser`
  - **Required Path:** Enter through the visible menu first. A second focused
    case may open `http://localhost:<port>/?skipmenu=1` to diagnose or verify
    the direct gameplay route, but `skipmenu` must not replace menu coverage.
  - **Required Assertions:** The game changes from menu to match; an active
    figure can be selected; the drag creates a valid shot; input is locked
    during simulation/playback; playback completes; the turn number or active
    team advances exactly once; entity state remains finite.
  - **Constraint:** Do not set handler state, inject a `TurnPacket`, invoke an
    emitter directly, or call gameplay methods from the test to manufacture a
    passing result. Browser input must cause the turn.
  - **Acceptance:** One player-visible browser interaction completes one real
    deterministic turn through the production UI and runtime path.
  - **Note:** Real browser input exposed two defects fixed in this task.
    `MatchResultOverlay.handleMousePressed()` returned early when the result
    screen was hidden and never delegated to the gameplay input, so every
    mousedown in a live match was swallowed and drag-to-shoot was impossible in
    the browser; it now passes presses through while hidden. The item phase had
    no browser-visible control (only unit-test paths used `ItemPhaseUI`), so
    the local match could never advance past the first item phase: new
    `src/ui/ItemPhaseControls.ts` (IDrawer + IMouse) draws the item panel and
    skip/use buttons in world coordinates and routes use/skip through the
    existing `ItemPhaseUI` -> emitter -> `RuleInterpreter` chain, delegating
    presses outside the panel to `UiSystem`; it also exposes `selectedActorId`
    and `reset()` so the scene input-surface contract (selection state visible
    through the result overlay) stays intact. `createLocalGameplayHandler()`
    installs the panel as mouse handler and post-drawer. Shared browser page
    helpers moved into `browserHarness` (`canvasGeometry`, `worldToPixel`,
    `clickWorld`, `dragWorld`, `readMatchState`, `activeGameModeId`,
    `finiteEntities`); `test:browser` now runs both browser test files. Two new
    tests: the menu path (visible menu -> canonical match -> skip item phase
    through the panel -> real drag-to-shoot -> `Playing` with finite velocity
    and input locked against a second drag -> turn 1 / team 1 with zero
    playback frames remaining) and a diagnostic `?skipmenu=1` route that also
    completes exactly one turn. Gates: 636 pass / 5 skip / 0 fail across 196
    files (2 new browser tests, 31 new assertions); TSC and production build
    clean.

- [x] **Task [16.4]: Verify Browser Gameplay Controls And Result Flow**
  - **Goal:** Exercise the browser-visible gameplay controls needed for a
    complete local match, including item-phase interaction where enabled,
    result display, rematch, and return to menu.
  - **Target Files:** browser E2E tests and focused UI/runtime fixes only
  - **Test File:** `tests/browser/local_match_flow.e2e.test.ts`
  - **Allowed Context:** `src/main.ts`, `src/menu/Menu.ts`,
    `src/item/ItemPhaseUI.ts`, `src/engine/Handler.ts`, local scene routing
  - **Commit:** `test: cover browser local match flow`
  - **Required Assertions:** Visible state indicators agree with the active
    team, rule phase, and turn; legal item use or item-phase skip works through
    browser controls; the match reaches an explicit winner or draw; the result
    overlay is visible; rematch restores a fresh playable state; menu exit
    returns to the landing page.
  - **Determinism:** Use a fixed test configuration and deterministic input
  - **Note:** No production changes were needed; the browser tests exposed the
    deterministic match-end path through the real runtime. Chromium floors
    fractional mouse coordinates to integer pixels, which quantizes world
    coordinates to a 0.625 grid (1/1.6 scale at 1280x720) and shifts drag
    angles by up to ~0.4 degrees - far wider than the chaotic kill-angle
    margins of the ice arena (all < 0.25 degrees). The kill shot is therefore
    pixel-exact: the drag vector (175.625, -2.5) from the quantized shooter
    spawn (131.875,131.875) reproduces the verified kill angle 179.1849 at
    power 10 exactly (drag end (307.5,129.375) lands on integer pixels), and
    the team-1 figure ends dead in the authoritative simulation and in the
    real browser. Two tests in `tests/browser/local_match_flow.e2e.test.ts`:
    the full flow (menu -> item use through the visible panel (allowance 0->1)
    -> item-phase skip -> kill turn -> result `winner`/team 0 with reason
    `last-team-standing` and the overlay condition -> rematch restores turn 0 /
    item phase / both figures alive / fresh inventory -> second kill turn ->
    menu exit returns to the landing state) and a no-mutation guard (a
    drag-to-shoot during the item phase is rejected by the shared validation
    without starting a turn or moving figures). `test:browser` now runs all
    three browser test files. Gates: 638 pass / 5 skip / 0 fail across 197
    files (2 new browser tests, 40 new assertions); TSC and production build
    clean.
    sequence. Record the seed and relevant configuration in failure output.
  - **Acceptance:** The browser test proves a complete player journey from menu
    to match result and through both post-match actions without developer tools.

- [x] **Task [16.5]: Add Browser Failure Artifacts And Diagnostics**
  - **Goal:** Make browser failures reproducible by preserving concise evidence
    from the failing run.
  - **Target Files:** browser test configuration, browser diagnostics helper,
    `.gitignore`
  - **Test File:** `tests/browser/browser_diagnostics.test.ts`
  - **Allowed Context:** browser E2E configuration and test helpers
  - **Commit:** `test: capture browser failure diagnostics`
  - **Required Artifacts On Failure:** Screenshot, browser console output,
    uncaught page errors, current URL, viewport, test seed/configuration, and a
    bounded trace or equivalent interaction log.
  - **Constraint:** Generated diagnostics must be ignored by Git and must not
    include credentials, private environment values, database contents, or
    unbounded logs.
  - **Acceptance:** A deliberately failing fixture proves that the expected
    artifacts are generated and identifies the failed browser step.
  - **Note:** New `tests/browser/browserDiagnostics.ts` provides
    `BrowserDiagnostics` (bounded interaction step log of 200 entries,
    allowlisted metadata records, and `capture()` writing a timestamped
    artifact directory under `.browser-diagnostics/`, which is now
    git-ignored) plus `runWithDiagnostics()` for capture-on-failure without
    masking the original error. Each capture writes `screenshot.png`,
    bounded `console.txt` (newest 500 lines), `page-errors.txt`,
    `context.txt` (reason, run name, URL, viewport, chromium version, and
    recorded configuration only - never env/credentials/database contents),
    and `interaction.log`; a second capture is a no-op so evidence is never
    overwritten. The fixture test deliberately fails a `waitFor` step after
    injecting a console error, an uncaught page exception, and a 550-line
    console flood, then proves every artifact exists with the failed step
    identified (`diagnostic-failing-step`), the oldest flood lines dropped
    (bounded output), a planted secret marker absent from `context.txt`, and
    idempotent capture. A second test proves a clean run captures nothing.
    Gates: 640 pass / 5 skip / 0 fail across 198 files (2 new tests, 35 new
    assertions); TSC and production build clean.

- [x] **Task [16.6]: Wire Browser Gameplay Verification Into Release Checks**
  - **Goal:** Add explicit package commands for focused browser smoke testing
    and full browser gameplay verification, then include their exact results in
    release documentation and the final release gate.
  - **Target Files:** `package.json`, CI configuration,
    `docs/release-verification.md`, `requirements.md`, `AGENTS.md`,
    `step-by-step.md`
  - **Test File:** `tests/browser/browser_release_gate.test.ts`
  - **Allowed Context:** completed Tasks 16.1-16.5 and existing release gates
  - **Commit:** `test: gate release on browser gameplay`
  - **Required Commands:** Provide one fast browser smoke command for startup
    plus one full command for the complete local browser match. Both commands
    must build the generated browser bundle and manage the Bun server lifecycle.
  - **Required Report:** Browser engine and version, viewport, tested URL,
    build result, server readiness result, menu startup result, completed turns,
    completed matches, console errors, page exceptions, screenshots/traces on
    failure, command duration, and final pass/fail status.
  - **CI Constraint:** Run headless in CI. Keep a documented headed/debug mode
    for local reproduction, but do not make headed execution the release gate.
  - **Acceptance:** A release candidate cannot be declared browser-playable
    unless the real browser smoke and complete local-match flow both pass.
  - **Note:** `package.json` now exposes `test:browser:smoke` (startup/menu,
    `tests/browser/browser_startup.e2e.test.ts`) and `test:browser:full`
    (all four browser test files); `test:browser` is an alias for full, and
    both commands build the generated bundle and manage the Bun server
    lifecycle through the harness. The harness gained a documented headed/
    debug mode (`BROWSER_HEADED=1`); CI stays headless via the new `browser`
    job in `.github/workflows/node.js.yml` (installs Playwright Chromium with
    deps, then runs smoke and full). `docs/release-verification.md` gains the
    "Section 16 Browser Playable Verification" record with the required report
    (Chromium 151.0.7922.34 / Playwright 1.62.1, 1280x720 viewport, isolated
    test URL, build PASS, server readiness PASS, menu startup PASS, 4 completed
    turns, 2 completed matches, 0 unexpected console errors/page exceptions,
    diagnostics artifacts on failure, durations 17.88s/51.16s, FINAL STATUS:
    PASS - browser-playable) while preserving the Section 15
    `BLOCKED / NOT QUALIFIED` human-evidence status. `requirements.md` gains
    row R-18, and AGENTS.md documents the commands plus the headed mode.
    `tests/browser/browser_release_gate.test.ts` gates the wiring: package
    scripts, CI job, the full report item set in the record, both command
    results, all 16.1-16.6 evidence files, checklist completion, and the
    requirements/AGENTS references. Recorded results: smoke 9 pass / 0 fail
    (37 assertions) in 17.88s, full 15 pass / 0 fail (143 assertions) in
    51.16s; full suite 647 pass / 5 skip / 0 fail across 199 files (8,042
    assertions) with `npx tsc --noEmit` and `bun run build` clean. Chapter
    complete: real browser builds, boots, plays local turns, completes matches
    through the visible UI, rematches, returns to the menu, and gates the
    release on both smoke and full browser verification.

### Section 16 Acceptance Criteria

```text
browser verification
→ builds and loads generated dist/main.js
```

```text
real page startup
→ Bun HTTP/WebSocket server + vendored p5 + visible canvas
```

```text
player action
→ real pointer events through UI → emitter → simulation → playback
```

```text
complete browser journey
→ menu → local match → result → rematch → menu
```

```text
browser failure
→ screenshot + console + page error + reproducible seed/configuration
```

```text
browser-playable release
→ smoke test and complete gameplay E2E both pass
```

Do not treat engine-only integration tests, DOM emulation, direct calls through
`window.game`, or successful TypeScript compilation as proof that the game works
in a browser.

## 17. Qualified Map Production And Verification

* [x] **Task [17.1]: Define The Qualified Map Design Contract**

  * **Goal:** Define the technical and gameplay requirements that every newly
    shipped map must satisfy before it can enter the qualified map matrix.
  * **Target Files:** `docs/map-design-contract.md`,
    `docs/map-qualification-report.md`
  * **Test File:** `tests/map_design_contract.test.ts`
  * **Allowed Context:** existing map schema, gameplay qualification contract,
    physics contract, browser-playable release record
  * **Commit:** `docs: define qualified map design contract`
  * **Required Contract:**

    * Map data must pass the existing schema and game-settings validators.
    * Every configured player must have a finite, non-overlapping, legal spawn.
    * Spawned figures must not begin inside solid geometry or lethal hazards.
    * Containment geometry must enclose all legal spawn and gameplay regions.
    * The first legal action must be reachable through the production rule path.
    * Every accepted action must settle within the existing playback bound.
    * The map must expose at least one technically reachable terminal mechanism.
    * A map may be symmetric or intentionally asymmetric, but the classification
      must be explicit.
    * Map qualification must not infer fairness from non-terminal samples.
    * Browser play must not depend exclusively on a sub-pixel or extremely
      narrow angle corridor.
  * **Required Classification:** `candidate`, `technically-qualified`,
    `browser-qualified`, `human-qualified`, `blocked`, or `rejected`.
  * **Constraint:** Existing gameplay, physics, softlock, fairness, and browser
    detectors must not be weakened to admit a map.
  * **Note:** New `docs/map-design-contract.md` defines the nine contract
    sections (data/schema, spawn, containment/geometry, action/playback,
    terminal, symmetry/fairness, browser, classification, constraint) exactly
    as specified: validators `validateMapDocument`/`loadMapDocument`/
    `validateGameSettings` plus the editor boundary; finite/non-overlapping
    spawns outside solid and lethal geometry; containment enclosing all legal
    regions; first action through the production rule path with the shared
    `isValidInput` boundary; playback within the 1,200-frame bound; at least
    one technically reachable terminal mechanism; explicit symmetric/
    asymmetric classification; no fairness inference from non-terminal
    samples; no dependence on sub-pixel or extremely narrow angle corridors;
    and the six-value classification (`candidate`, `technically-qualified`,
    `browser-qualified`, `human-qualified`, `blocked`, `rejected`) with the
    release rules (no `human-qualified` without human evidence; no
    unqualified map shipped as qualified). New `docs/map-qualification-report.md`
    opens the status ledger with every known map (`ice-map-v1`, `cue-clash`,
    `frostbite-arena`, `magma-cradle`) honestly classified as `candidate` and
    explicitly records that no map receives a qualification before the Task
    17.3 harness and 17.7 matrix evidence. `tests/map_design_contract.test.ts`
    (5 tests / 39 assertions) gates the contract document content, the exact
    six-value classification table, the named existing detectors, the honest
    candidate-only ledger, and the absence of premature qualification claims.
    Full suite: 652 pass / 5 skip / 0 fail across 200 files (8,081
    assertions); TSC clean; `git diff --check` clean.

* [x] **Task [17.2]: Inventory Existing And Candidate Maps**

  * **Goal:** Build one authoritative inventory of all existing shipped maps,
    experimental maps, editor fixtures, and planned Section 17 candidates.
  * **Target Files:** `docs/map-qualification-report.md`,
    map registry or canonical map index
  * **Test File:** `tests/map_content_inventory.test.ts`
  * **Allowed Context:** validated map loader, map registry, existing canonical
    maps, editor-export fixtures
  * **Commit:** `docs: inventory qualified map content`
  * **Required Inventory Fields:** stable map ID, display name, source file,
    schema version, dimensions, symmetry classification, spawn count, structure
    count, hazard types, drift/friction settings, supported team layouts,
    browser availability, current qualification status, and known limitations.
  * **Negative Cases:** duplicate IDs, unregistered shipped files, registry
    entries without source data, source data not reachable through the validated
    loader, or documentation claiming qualification without committed evidence.
  * **Constraint:** Existing maps must retain their real qualification status;
    inventory work must not silently promote experimental content.
  * **Note:** New authoritative index `src/content/mapCatalog.ts` carries all
    seven inventory entries (shipped: `ice-map-v1`, `cue-clash`,
    `frostbite-arena`, `magma-cradle`; planned Section 17 candidates:
    `symmetric-duel`, `structure-control`, `hazard-control`) with every
    required field: stable map ID, display name, source file, schema version
    (template or document v1), dimensions (fixed or scalable), explicit
    symmetry classification (all symmetric), spawn region count (2), structure
    count and hazard count/types derived from the real map data, friction
    preset, drift, supported team layouts (2 teams, 1/2/6 figures), browser
    availability, current status (all `candidate`), and known limitations.
    `buildMapSettings()` loads every shipped map through
    `loadMapDocument()`/`validateGameSettings()` and throws for planned
    candidates until their task creates the source file, so no entry is
    silently loadable before it exists. `docs/map-qualification-report.md`
    gains the full inventory ledger (all 13 required report fields) and an
    explicit rule that no map is promoted by inventory work alone.
    `docs/map-design-contract.md` now names the catalog as the classification
    authority. `tests/map_content_inventory.test.ts` (7 tests / 128
    assertions) covers the negative cases: duplicate IDs, missing source
    files, source data not reachable through the validated loader, unknown
    IDs rejected, planned entries not loadable, catalog counts matching the
    loaded map data, and the report claiming no qualification without
    committed evidence. Full suite: 659 pass / 5 skip / 0 fail across 201
    files (8,209 assertions); TSC clean; `git diff --check` clean.

* [x] **Task [17.3]: Add A Reusable Map Qualification Harness**

  * **Goal:** Add a deterministic harness that accepts validated map settings
    and produces one structured technical qualification result.
  * **Target Files:** `tests/support/mapQualification.ts`, map-loading helpers
  * **Test File:** `tests/map_qualification_harness.test.ts`
  * **Allowed Context:** gameplay qualification harness, fairness tournament,
    AI match fuzz support, physics fixtures, validated map loader
  * **Commit:** `test: add automated map qualification harness`
  * **Required Checks:**

    * schema and settings validation,
    * finite and unique spawn state,
    * no initial solid overlap,
    * no initial lethal-hazard overlap,
    * containment validity,
    * legal first action,
    * bounded playback,
    * deterministic duplicate-run equality,
    * snapshot and restore equality,
    * replay equality,
    * terminal result or explicit bounded ongoing classification,
    * no post-completion mutation.
  * **Required Output:** map ID, seed, variant, accepted actions, turns,
    simulated frames, engine work, result, safety-limit status, spawn findings,
    invariant findings, replay/restore status, and deterministic fingerprint.
  * **Negative Cases:** malformed map data, impossible spawn, initial death,
    no legal actor, no-op-only actions, playback stall, repeated full state,
    non-finite physics state, and duplicate-run mismatch.
  * **Constraint:** A safety-limit result remains a warning or failure according
    to the existing qualification contract; it must never be converted into an
    artificial draw.
  * **Note:** New harness `tests/support/mapQualification.ts` provides
    `qualifyMapSettings(settings, options, mapId)` (per-run clone of the
    settings because `GameHandlerBuilder.fromSettings` retains references into
    the passed object), `qualifyMap(mapId, options)`, `inspectMapSettings()`,
    and `mirrorSettings()` (mirror x + swap teams), with constants
    `MAP_PLAYBACK_BOUND = 1200`, `MAP_DEFAULT_MAX_TURNS = 24`, and
    `MAP_QUALIFICATION_SEEDS = [1503, 1504]`. Every required check is
    implemented: schema/settings validation; finite, unique, solid-free and
    lethal-free spawn state; explicit containment rect (or inferred solid
    extents) enclosing all spawns and the world; legal first action through
    the production AI/emitter rule path; per-turn bounded playback measured on
    the live playback state; deterministic duplicate-run equality; snapshot
    restore equality; replay equality via `ReplayPlayer`; terminal result or
    explicit bounded ongoing classification; and a 10-tick no-post-completion
    mutation probe. The engine's Section 13 explicit failure (thrown solver
    errors) is converted into a structured failed run whose schema/spawn
    checks keep their real values and whose failure message becomes the
    invariant finding; duplicate runs failing identically remain
    deterministic, so a deterministic blocked map is distinguishable from a
    crash or an artificial draw. The three document maps
    (`cue-clash`, `frostbite-arena`, `magma-cradle`) previously lacked
    containment geometry and their players left the world: each now prepends
    an explicit `{ type: SHAPE.RECTANGLE, x: 0, y: 0, w, h, role:
    "containment", effects: [] }` rect as the first `arenaGeometry` element
    (structure counts 7 -> 8 in the catalog/report). Harness evidence at both
    seeds: `ice-map-v1`, `cue-clash`, and `magma-cradle` pass the full matrix
    (winners, bounded playback, deterministic, snapshot/replay clean,
    no post-completion mutation); `frostbite-arena` deterministically throws
    "Unresolved penetration after max solver iterations" at both seeds - a
    two-player wall jam under drift 1.0 that the Section 13 solver cannot
    resolve - and is classified as a structured blocked result
    (`safetyLimitStatus` "failure", never an artificial draw). The negative
    cases cover malformed data (schema failure), lethal spawn, dead spawn/no
    legal actor, a true playback stall (no structures, no handler or
    per-player physics effects, friction 1/drag 0), playback bound exposure,
    and custom settings labelling. `tests/map_qualification_harness.test.ts`
    (12 tests / 230 assertions) gates the positive matrix, the deterministic
    blocked classification, side-swapped mirroring, and all negative cases.
    Full suite: 671 pass / 5 skip / 0 fail across 202 files (8,439
    assertions); TSC clean; `git diff --check` clean.

* [x] **Task [17.4]: Add A Symmetric Duel Map**

  * **Goal:** Create one low-complexity, symmetric two-team map that emphasizes
    direct player interaction and broad, understandable terminal routes.
  * **Target Files:** new validated map data file, canonical map registry
  * **Test File:** `tests/symmetric_duel_map.test.ts`
  * **Allowed Context:** existing map schema, canonical Ice Duel settings,
    containment and solid-structure contracts
  * **Commit:** `feat: add symmetric duel map`
  * **Required Characteristics:**

    * mirrored spawn geometry,
    * equal initial distance to meaningful structures and hazards,
    * no unavoidable first-turn elimination,
    * at least two materially different legal opening actions,
    * a terminal route that does not require pixel-exact browser input,
    * no new engine behavior or map-only executable code.
  * **Required Verification:** schema validation, settings round trip,
    deterministic first turn from both sides, side-swapped equality, bounded
    playback, and browser-visible initial state.
  * **Constraint:** The map must be expressed entirely through existing map,
    structure, hazard, effect, and settings primitives.
  * **Note:** Committed as `feat: add symmetric duel map`. New map
    `src/settings/symmetricDuelMap.ts` (document schema v1, ice friction,
    drift 0, spawns at (150,150)/(650,150) for the size-12 canonical figures,
    one explicit containment rect and one central wall
    (360,126,80,48)); promoted the `symmetric-duel` catalog entry from planned
    to a loadable candidate and added the map to the 17.3 qualification
    matrix. Empirical design facts behind the geometry: the canonical
    template's per-player baked ice friction dominates, so power-2 shots stop
    after ~123 px and power-10 after ~1285 px; in an open arena a power-10
    direct hit eliminates the defender from every tested spawn spacing, so a
    central wall is required to make first-turn elimination impossible. The
    wall covers the full corridor band (y 138..162 at the wall plane) with
    12 px margins; a 360-angle x 10-power sweep proves no legal opening can
    eliminate the opponent on turn 1. The arena walls double as the
    containment kill boundary, so the terminal route is a broad off-axis
    drive of the defender's puck into an outer wall (verified at powers
    6-10 without pixel-exact aim). Spawns sit 138 px from the walls, beyond
    the power-2 stop distance, so weak openings are safe. The harness
    qualifies both seeds as deterministic winners with bounded playback,
    replay/restore clean, and side-swapped equality. Known character (not a
    defect): strong shots into a wall self-eliminate, and the stock easy AI
    frequently eliminates itself, keeping the harness games short.

* [x] **Task [17.5]: Add A Structure-Control Map**

  * **Goal:** Create one map centered on positioning around solid structures,
    rebounds, protected regions, and multiple approach paths.
  * **Target Files:** new validated map data file, canonical map registry
  * **Test File:** `tests/structure_control_map.test.ts`
  * **Allowed Context:** solid/containment roles, circle/rectangle/line
    collision contracts, existing official maps
  * **Commit:** `feat: add structure control map`
  * **Required Characteristics:**

    * at least two distinct navigable lanes,
    * no spawn embedded in or trapped by solid geometry,
    * no single structure that permanently partitions all opponents,
    * deterministic line and corner interaction,
    * meaningful positional change from ordinary legal actions,
    * broad enough action margins for real pointer input.
  * **Required Verification:** initial-overlap scan, representative collision
    fixtures, deterministic mirrored turns, bounded multi-contact resolution,
    replay/restore equality, and no softlock under the map qualification harness.
  * **Constraint:** Do not modify the global physics contract merely to make the
    candidate map pass; reject or redesign invalid geometry instead.
  * **Note:** Structure Control ships as `src/settings/structureControlMap.ts`
    (blueprint 800x450, billiards friction, drift 0, no hazards): explicit
    containment rect (0,0,800,450), four mirrored columns
    (300,70,16,80)/(300,300,16,80)/(484,70,16,80)/(484,300,16,80), and a
    central blocker (392,213,16,24), with spawns at (150,225)/(650,225)
    (region x 138/638, y 213, w 200, h 350) landing exactly on the
    horizontal symmetry axis. Empirical facts established before the final
    design: the arena walls are the containment kill boundary (any puck whose
    full circle leaves the world rect dies), puck-structure collisions are
    elastic, and map-level friction settings are decorative because each
    player carries baked default ice `EffectPhysics` (power 2 stops at ~123
    px, power 10 at ~1285 px). The blocker seals the direct spawn corridor
    (first-turn contact impossible), leaving three safe routes: the upper
    corridor gap (y 150..213), the lower corridor gap (y 237..300), and the
    flanking top/bottom lanes; columns 16 px wide with 63 px gaps create
    deterministic corner grazes (angle 348 power 6 deflects off the right-top
    column corner into the bottom-left pocket, reproducing bit-identically).
    Verification: `tests/structure_control_map.test.ts` (16 tests) covers
    schema validation, settings round trip, mirrored spawns with every
    structure >= 100 px away, geometric lane widths (all three routes >= 2 x
    radius), no single permanent partition, a full 360-angle x 10-power sweep
    with zero opponent eliminations (259 strong shots self-eliminate in the
    kill ring), deterministic line and corner fixtures, bounded multi-contact
    resolution under the 1200-frame bound, both lanes crossing alive (upper
    to (787,113), lower to (787,337)), +/-3 degree corridor-tap margins,
    deterministic mirrored turns, side-swapped equality with winners at both
    seeds, and the browser-visible initial state. The 17.2 inventory and 17.3
    qualification gates gained structure-control (planned set reduced to
    `hazard-control`). Gates at commit: full suite green, strict TypeScript
    clean, build clean.

* [x] **Task [17.6]: Add A Hazard-Control Map**

  * **Goal:** Create one map whose primary terminal pressure comes from existing
    declarative hazards while preserving meaningful player agency.
  * **Target Files:** new validated map data file, canonical map registry
  * **Test File:** `tests/hazard_control_map.test.ts`
  * **Allowed Context:** hazard registry, kill/force/rotation/slow/delayed
    hazards, item and effect settings
  * **Commit:** `feat: add hazard control map`
  * **Required Characteristics:**

    * hazards are visible and spatially understandable,
    * no player begins within an active lethal region,
    * ordinary actions can move opponents toward and away from danger,
    * hazard placement does not make one physical side automatically terminal,
    * delayed hazards restore deterministically from snapshots where used,
    * at least one non-lethal recovery route remains available.
  * **Required Verification:** deterministic hazard activation, hazard-seeking
    fixture, hazard-avoidance fixture, no instant-death baseline, explicit
    winner path, side-swapped run, snapshot continuity, and replay equality.
  * **Known Limitation:** Stock hard AI may fail to seek lethal hazards. Use a
    deterministic mode-appropriate hazard policy for terminal-path evidence and
    retain the stock-AI result separately as a warning.
  * **Constraint:** Qualification must distinguish “map cannot terminate” from
    “the selected AI policy does not pursue the terminal mechanism.”
  * **Note:** Hazard Control ships as `src/settings/hazardControlMap.ts`
    (blueprint 800x450, tiles friction, drift 0): one containment rect and
    two mirrored kill-zone hazards at (300,225) and (500,225) with radius 28,
    no solids, spawns at (150,225)/(650,225). The zones sit directly on the
    line between the spawns, so every straight crossing is self-eliminating
    (the shooter's own puck dies in the near zone) and the opponent is
    protected behind its own zone; the north and south flank lanes are the
    non-lethal recovery routes, and elimination requires driving an opponent
    into a hazard or its own misplay. Empirical probes: a straight power-6
    shot dies deterministically at (260.0,225) inside the west zone; the
    north flank (angle 335 power 4) crosses alive to (477,72) and the south
    flank (angle 20 power 4) to (489,348), both clear of the hazard bands; a
    drive from the east (shooter (700,225), defender (650,225), angle 175-185,
    powers 4-8) pushes the defender into the east zone with the shooter
    surviving. Verification: `tests/hazard_control_map.test.ts` (15 tests)
    covers schema validation, settings round trip, mirrored hazard geometry
    with spawn clearance >= 60 px, an initial-overlap scan, a full sweep
    (87 safe openings, zero opponent eliminations), deterministic hazard
    activation, hazard-avoidance and hazard-seeking fixtures, an explicit
    winner path (scripted match ends with team 0 winning inside the east
    kill zone), deterministic mirrored turns, side-swapped equality with
    winners at both seeds, snapshot continuity and replay equality through
    the full qualification matrix, and the browser-visible initial state.
    Stock-AI note: the harness Easy AI plays a seeded random walk and
    terminates the seeded games via containment-wall contact; hazard
    terminal-path evidence comes from the deterministic fixtures, retained
    separately as a warning (17.6 policy). The 17.2 inventory and 17.3
    qualification gates gained hazard-control (planned set is now empty).
    Gates at commit: full suite green, strict TypeScript clean, build clean.

* [x] **Task [17.7]: Qualify The Complete Map Matrix**

  * **Goal:** Run every shipped and Section 17 candidate map through the shared
    technical qualification matrix and record comparable evidence.
  * **Target Files:** map qualification harness,
    `docs/map-qualification-report.md`, `package.json`
  * **Test File:** `tests/shipped_map_matrix.test.ts`
  * **Allowed Context:** Tasks 17.1–17.6, gameplay content matrix, softlock
    detection, match-length distribution, fairness tournament
  * **Commit:** `test: qualify shipped map matrix`
  * **Required Method:**

    * run multiple deterministic seeds per map,
    * run original and side-swapped spawn variants,
    * swap first turn where supported,
    * use at least one direct-pressure policy,
    * use a terminal-mechanism-aware policy where the map requires one,
    * repeat the matrix byte-for-byte.
  * **Required Metrics:** qualification counts, terminal rate, draw rate,
    ongoing rate, instant-death rate, turn-limit rate, minimum/median/p90/p95/
    maximum turns, accepted actions, simulated frames, engine work, left/right
    wins, team-index wins, first-turn wins, invariant failures, and replay/
    restore failures.
  * **Hard Failures:** invalid map data, illegal spawn, non-finite state,
    playback violation, deterministic mismatch, snapshot/replay mismatch,
    post-completion mutation, or an undocumented shipped map.
  * **Warning Signals:** side advantage, first-turn advantage, frequent ongoing
    matches, narrow terminal corridor, extreme duration outlier, weak agency,
    or policy-dependent termination.
  * **Required Commands:** add `bun run test:maps` and
    `bun run test:maps:matrix`.
  * **Constraint:** Small-sample fairness findings are warnings pending human
    review unless they expose an invariant or unavoidable elimination.
  * **Note (17.7):** The matrix is a resumable, content-addressed cell cache
    under gitignored `.matrix-cache/` (`tests/support/matrixCache.ts`): a cell
    is keyed by resolved map settings, seed, variant, policy, policy limits,
    qualification limits, cache-schema version, and a fingerprint of all
    engine/physics/rule/AI/harness sources; records are stored atomically and
    structurally validated on load, so malformed, incomplete, or failed cells
    are never reused; provenance per cell shows cached vs freshly executed.
    All tests share one loaded/computed matrix. `bun run test:maps` is the
    dev smoke run (cache-backed, `MAP_MATRIX_CACHE=0` bypasses);
    `bun run test:maps:matrix` is the release command: two genuinely fresh
    complete executions (12 seeds x 7 maps x 3 variants x 2 policies = 504
    cells each) persisted per attempt (`MAP_MATRIX_ATTEMPT_ID` resumes a
    failed attempt, recomputing only invalidated cells) and compared
    byte-for-byte; the dev repeat test reruns a deterministic representative
    sample twice fresh and validates the cache against it (never
    cached-vs-cached). Demonstrated: cold run stores 42/42 cells; warm run
    reuses 42/42 (~11s vs ~41s); a map-source change invalidates only that
    map's 6 cells; a tampered release cell is detected as a byte-for-byte
    MISMATCH on resume; truncated/deleted cells are recomputed. The full
    release matrix (attempt `release-2026-08-01`): 504+504 fresh cells,
    byte-for-byte MATCH, 0 hard failures; metrics and the four expected
    warning signals (first-turn advantage 0.44, frequent ongoing 0.51,
    extreme duration outlier, policy-dependent termination easy 0.17 vs hard
    0.86) are recorded in `docs/map-qualification-report.md`. The full-matrix
    pass also caught and fixed a harness artifact: post-completion mutation
    and replay-equality checks now apply to completed matches only, and the
    reference snapshot is taken before any extra verification ticks (an
    ongoing turn-limited run at seed 2107 exposed the mismatch).

* [x] **Task [17.8]: Verify Qualified Maps In The Real Browser**

  * **Goal:** Load every technically-qualified map through the production
    browser UI and prove that a player can enter the map and perform one real
    legal action with pointer input.
  * **Target Files:** browser E2E tests, browser map-selection path, shared
    browser harness only where reusable helpers are missing
  * **Test File:** `tests/browser/map_catalog.e2e.test.ts`
  * **Allowed Context:** Section 16 browser harness, map registry, production
    menu and local-match scene
  * **Commit:** `test: verify qualified maps in browser`
  * **Required Browser Flow:**

    * start the real Bun server,
    * open the visible menu,
    * select each qualified map through production UI,
    * verify its stable map ID and visible finite entities,
    * verify expected structures or hazards are rendered,
    * advance the item phase through visible controls where present,
    * perform one real pointer-driven legal action,
    * observe simulation and bounded playback,
    * return to the menu without console or page errors.
  * **Required Full-Journey Coverage:** At least one newly added map must also
    complete `menu -> map -> terminal result -> rematch -> menu`.
  * **Failure Evidence:** reuse bounded screenshot, console, page-error,
    interaction-log, seed, map ID, and viewport diagnostics from Section 16.
  * **Constraint:** Tests must not call `GameEmitter`, handler mutation methods,
    or gameplay APIs directly to manufacture a passing result.
  * **Done:** the production menu gained a `Choose Map` page
    (`src/menu/Menu.ts`, `MapSelectionPage`) listing exactly the
    `browserAvailable` catalog entries; `LocalMatchSceneRouter`/
    `createLocalGameplayHandler(mapId)` load any catalog map through
    `buildMapSettings` while keeping the canonical `local-ice-duel-v1`
    gameMode, and `window.game.mapId` exposes the stable map ID of the
    active match (null in the menu). `loadMapDocument` now assigns the
    default render color `#315b7d` to uncolored solid geometry (containment
    stays invisible), which the pixel-probe evidence verified was required
    for document maps to be visibly rendered; the matrix cache recomputed
    the affected document-map cells once (the recorded release attempt
    remains valid evidence of its snapshot). `tests/browser/map_catalog.e2e.test.ts`
    walks all six qualified maps through real pointer input (landing ->
    main menu -> choose map -> row), asserts the stable map ID, finite
    entities, authoritative boundary counts, canvas pixel probes for
    structures/hazards (with open-floor contrast references; the engine
    template renders its walls in debug blue), item-phase skip through the
    visible panel, one legal weak opening (power ~1.2 toward the team's own
    side) with bounded playback observed (0 < frames <= 1200, then 0), a
    clean return to the menu via fresh boot, and a full hazard-control
    journey (menu -> map -> terminal result via the broad 17.6 kill-zone
    drive -> rematch -> second terminal match -> menu) with zero console
    errors. `test:browser:full` grew to 17 tests across 5 files (301
    assertions, 71s). The six qualified maps are promoted to
    `browser-qualified` with `browserAvailable: true` in the catalog, the
    report ledger, and all per-map/inventory/harness/design-contract tests;
    frostbite-arena stays `blocked`. The Section 16 release record and the
    browser release gate were updated for the new full-suite count.

* [x] **Task [17.9]: Record Map Review And Human-Test Readiness**

  * **Done:** Shipped the external-tester review packet: `docs/map-playtest-protocol.md`
    (six browser-qualified candidates, frostbite-arena excluded; exact build
    or deployed browser revision verification, play from the visible
    "Choose Map" menu page, per-tester rotated map order, verbatim
    first-confusion and first-meaningful-strategy recording, the seven
    per-map ratings readability/navigation/hazard clarity/agency/pacing/
    fairness/willingness to replay, and per-map evidence collection with
    map ID, settings seed, screenshot, console/log export, and blocker
    severity), the map-specific issue template
    `.github/ISSUE_TEMPLATE/map-playtest-finding.md` (severity, map ID, seed,
    evidence fields), and the readiness gate
    `tests/map_playtest_readiness.test.ts` (6 tests) asserting every
    required session element, the PENDING human-evidence status, and the
    separation from Section 15 release blockers. The report ledger records
    the 17.9 evidence bullet; human-qualified remains unclaimed for every
    map.

  * **Goal:** Produce a map-specific review packet that allows external testers
    to compare the qualified candidates without repository access or developer
    explanation.
  * **Target Files:** `docs/map-playtest-protocol.md`,
    `docs/map-qualification-report.md`,
    `.github/ISSUE_TEMPLATE/map-playtest-finding.md`
  * **Test File:** `tests/map_playtest_readiness.test.ts`
  * **Allowed Context:** Section 15 human-playtest protocol, questionnaire,
    Section 16 packaged/browser build evidence
  * **Commit:** `docs: prepare structured map playtests`
  * **Required Session:**

    * verify the exact build or deployed browser revision,
    * play each selected map from the visible menu,
    * randomize or rotate map order between testers,
    * record first confusion and first meaningful strategy,
    * rate readability, navigation, hazard clarity, agency, pacing, fairness,
      and willingness to replay,
    * collect map ID, seed, screenshot/log evidence, and blocker severity.
  * **Required Status:** Human evidence remains `PENDING` until a real external
    session is completed. Automated tests may qualify readiness but must not
    manufacture human ratings.
  * **Constraint:** Map-level human qualification must remain separate from the
    existing Section 15 gameplay release blockers.

* [x] **Task [17.10]: Gate Qualified Map Content**

  * **Goal:** Add a final evidence gate that admits only maps backed by the
    required schema, technical, deterministic, browser, and documentation
    evidence.
  * **Target Files:** `docs/release-verification.md`, `requirements.md`,
    `AGENTS.md`, `package.json`, CI workflow, `step-by-step.md`
  * **Test File:** `tests/map_release_gate.test.ts`
  * **Allowed Context:** all Section 17 artifacts and existing release-gate
    patterns
  * **Commit:** `test: gate release on qualified maps`
  * **Required Commands:**

    * `bun run test:maps`
    * `bun run test:maps:matrix`
    * `bun run test:browser:full`
    * `bun test`
    * `npx tsc --noEmit`
    * `bun run build`
    * `git diff --check`
  * **Required Evidence:** exact commit, qualified/blocked/rejected map IDs,
    deterministic seed count, matrix result, pacing and fairness warnings,
    browser result, console/page-error totals, diagnostic artifact paths when
    applicable, known limitations, and current human-test status.
  * **Release Rule:** A map may be marked `technically-qualified` and
    `browser-qualified` without human evidence, but it must not be marked
    `human-qualified`.
  * **Chapter Rule:** Section 17 may be complete while individual candidates
    remain blocked or rejected, provided every candidate has an explicit,
    evidence-backed status and no unqualified map is shipped as qualified.

### Section 17 Acceptance Criteria

```text
map candidate
→ strict schema and settings validation
```

```text
configured spawn
→ finite, legal, visible, and non-overlapping
```

```text
accepted action
→ meaningful deterministic state change
```

```text
map simulation
→ bounded playback with no invariant violation
```

```text
terminal mechanism
→ technically reachable or explicitly blocked
```

```text
mirrored tournament
→ reproducible side, team, and first-turn evidence
```

```text
qualified map
→ snapshot and replay equality
```

```text
real browser
→ visible map selection and pointer-driven play
```

```text
browser failure
→ bounded screenshot, console, page-error, interaction, seed, and map evidence
```

```text
map catalog
→ every candidate classified as qualified, blocked, or rejected
```

```text
human quality
→ remains pending until external playtest evidence exists
```

```text
map release
→ only evidence-backed qualified content is exposed as qualified
```

## 18. Online Join Configuration

* [x] **Task [18.1]: Join Matches Through A Configurable Public Base URL**

  * **Goal:** Let the browser menu join a multiplayer match on a configurable
    server base URL instead of requiring a manually typed `?url=` query
    parameter. The default is the canonical deployment at
    `https://lupricht.net/kore`, and the value comes from the `KORE_BASE_URL`
    environment variable on the server.
  * **Target Files:** `server.ts`, `src/server/config.ts`,
    `src/utils/onlineConfig.ts`, `src/menu/Menu.ts`,
    `tests/browser/browserHarness.ts`
  * **Test File:** `tests/server_config.test.ts`,
    `tests/online_client_config.test.ts`, `tests/online_join_menu.test.ts`,
    `tests/server_config.integration.test.ts`, and the Play Online action in
    `tests/browser/browser_startup.e2e.test.ts`
  * **Allowed Context:** server entry point, network protocol runtime,
    browser startup branch, menu pages
  * **Commit:** `feat: join online matches from a configurable base URL`
  * **Required Contract:**

    * The server reads `KORE_BASE_URL` (default `https://lupricht.net/kore`),
      derives the matching WebSocket URL, and rejects malformed values at
      startup.
    * The server publishes `{ baseUrl, wsUrl }` as a never-cached `/config`
      JSON contract without broadening the static-file allowlist for other
      paths.
    * The browser menu offers a "Play Online" action that reads `/config`,
      falls back to the page origin and then to the built-in default
      deployment, and navigates to `?skipmenu=1&url=<ws-url>` while preserving
      the current path (path-prefix deployments).
    * The manual `?url=` query override keeps working unchanged.
    * A real browser run proves the full join flow: menu click, correct
      navigation parameters, and two incognito tabs matched into one game.
  * **Note:** `.env` is tracked, so `KORE_BASE_URL` intentionally stays out of
    it; operators set the variable on the deployed server. Local multiplayer
    development keeps working through `?skipmenu=1&url=ws://localhost:4001` or
    a server-side `KORE_BASE_URL` override.

## 19. KI-vs-KI Battle

* [x] **Task [19.1]: Autonomous KI-vs-KI Battle From The Main Menu**

  * **Goal:** Let the menu start a spectator battle in which both teams are
    played by the AI automatically, without any pointer input.
  * **Target Files:** `src/ai/AiBattleSystem.ts`, `src/menu/Menu.ts`,
    `src/scenes/LocalMatchSceneRouter.ts`, `src/ai/aiEmitter.ts`
  * **Test File:** `tests/ai_battle_menu.test.ts`,
    `tests/ai_battle_match.test.ts`, `tests/ai_battle_maps.test.ts`,
    `tests/browser/browser_ai_battle.e2e.test.ts`
  * **Allowed Context:** AI drivers, menu pages, local match scene wiring,
    browser E2E harness
  * **Commit:** `feat: add a KI vs KI battle to the main menu`
  * **Required Contract:**

    * The main menu offers a "KI vs KI" action (world rect
      `(270..530, 176..234)`); the existing Play Online, Play Local Game, and
      Choose Map rectangles stay reachable at their documented coordinates.
    * The "KI vs KI" action opens the Choose Map page in battle mode, and the
      selected map starts the battle; the page filters to `battleAvailable`
      catalog maps (battles must terminate on the stock hard AI), while the
      human local path keeps every `browserAvailable` map. A pending
      local/battle intent is discarded when the map page is left via Back.
    * The battle reuses the validated canonical settings, the winning
      evaluator, and the local `GameEmitter` turn flow; both teams are driven
      through the shared `AiTurnEmitter` input boundary with bounded hard-AI
      search limits.
    * The `AiBattleSystem` skips the item phase (the stock AI never chooses
      items) and submits exactly one legal shot per physics phase; it also
      implements the passive mouse contract so the result overlay can wrap it
      without accepting human input.
    * A battle plays to a consistent terminal result (winner or draw),
      survives persistence round trips, and rematches to a playable turn
      zero.
    * Every `battleAvailable` catalog map terminates an autonomous battle
      with a finite result (`tests/ai_battle_maps.test.ts`); maps whose
      geometry blocks every AI kill route (e.g. symmetric-duel) keep
      `battleAvailable: false` and stay hidden from the battle selection.
    * The browser bundle must not pull server-only modules: the AI path uses
      the pure `src/input/validate.ts` boundary, not the `gameRegistry`
      re-export.
    * A real browser run proves the full flow: menu click, map selection,
      battle start with the `AiBattleSystem` installed behind the result
      overlay, the selected map ID on the debug surface, and at least one
      completed turn without input.

* [x] **Task [19.2]: Seed-Varied Battles And Seed-Sensitive Hard AI**

  * **Goal:** Every battle (start and rematch) must be a different game, while
    every seed stays fully reproducible for replays and persistence.
  * **Target Files:** `src/ai/hardAi.ts`,
    `src/scenes/LocalMatchSceneRouter.ts`
  * **Test File:** `tests/ai_battle_seed_variation.test.ts`
  * **Commit:** included in `feat: add a KI vs KI battle to the main menu`
  * **Required Contract:**

    * `HardAi` resolves its bounded search deterministically from
      `AiSettings.seed`: the fallback angle grid is rotated by a seeded offset
      and equally-best candidates break ties through `SeededRandom`, so every
      seed plays a different game. Killing moves stay preferred and
      non-killing ties keep aiming at an enemy, so seeded matches still
      terminate. Easy and medium AI already consume the seed.
    * The scene draws a fresh battle seed for every menu battle start
      (injectable `battleSeedSource`, exposed as `getBattleSeed()`) and
      re-draws it on battle rematch; a battle rematch rebuilds the scene
      instead of replaying the same seeded decisions, while the human local
      rematch keeps replaying the identical settings.
    * Different battle seeds produce different recorded shot sequences; the
      same seed replays the identical game (shots, ticks, result).
    * The deterministic Section 11 convergence arena recalibrated to the new
      seed tie-break (52 turns / 53 actions for AI seeds 111/222); killing
      moves stay preferred and non-killing ties keep aiming at an enemy, so
      seeded matches still terminate.

## 20. Online Match Operations, Sharing, And Player Support

This chapter adds an operational surface around the existing authoritative Bun
server, SQLite snapshots, replay contracts, and browser scene lifecycle. It
does not make a client authoritative: game state, match status, map selection,
replay exports, report ownership, and dashboard totals remain server-derived.
Each public identifier introduced here must be an opaque, unguessable share
token rather than a sequential database or game ID. "Paused" means an
authoritative, mutually agreed server pause (not a browser tab that stopped
rendering); "sleeping" means a persisted, restorable game evicted from the
in-memory registry; and "now" means a live cached game which is neither
completed nor sleeping. Metrics must count these disjoint states and must not
invent a zero for data the current server cannot establish.

* [x] **Task [20.1]: Define Authoritative Match Status And Dashboard Metrics**

  * **Done:** `game_lifecycle` migrates existing SQLite snapshots into a
    versioned `resident`/`paused`/`sleeping`/`completed` lifecycle, normalizes
    stale resident rows after process restart, and persists transitions with
    snapshots. `GameRegistry.getMetrics()` uses SQLite for all-time/paused/
    sleeping totals and its cache only for the explicitly process-scoped `now`
    count. Authoritative handlers now install `WinningSystem`; terminal turns
    transition to completed, paused/completed actions reject before mutation,
    and rematch returns the same row to resident. Focused migration, restart,
    metrics, idempotency, and pause-gating coverage is in
    `tests/server_match_metrics.test.ts` and
    `tests/persisted_match_status.test.ts` (serial SQLite lifecycle cases).

  * **Goal:** Define one persisted lifecycle/status model from which the server
    dashboard can report all-time games, games active now, paused games, and
    sleeping games without double-counting reconnecting, completed, or evicted
    matches.
  * **Target Files:** `src/server/types.ts`, `src/server/db.ts`,
    `src/server/gameRegistry.ts`, server migration helpers
  * **Test File:** `tests/server_match_metrics.test.ts`,
    `tests/persisted_match_status.test.ts`
  * **Allowed Context:** current SQLite game store, registry cache eviction,
    reconnect restoration, completed-match rules
  * **Commit:** `feat: track authoritative match lifecycle metrics`
  * **Required Contract:**

    * Persist an explicit, versioned status and timestamps for every created
      match; migrate existing rows safely and retain completed rows for the
      all-time count.
    * Define and test mutually exclusive counts: `allTime` (every successfully
      created game), `now` (live resident ongoing games), `paused` (ongoing
      games in the authoritative paused state), and `sleeping` (ongoing
      persisted games not resident in the registry). A completed game appears
      only in `allTime`.
    * Reconnect restoration, the final disconnect, idle eviction, rematch, and
      completion must make exactly one status transition and remain idempotent
      across repeated runtime events and process restart.
    * A paused match accepts no turn or item actions. Do not treat a local
      pause-menu overlay, a disconnected player, or a sleeping match as an
      authoritative pause.
    * Use database aggregation plus explicitly scoped registry facts rather
      than process-local counters, so the all-time and sleeping values survive
      restart. State the consistency boundary for the live `now` value in the
      API response.

* [x] **Task [20.2]: Publish A Minimal Safe Server Dashboard**

  * **Done:** `src/server/dashboard.ts` serves only exact authenticated
    `/operator/dashboard` and `/operator/dashboard/metrics` routes. A
    deployment-provided 32-byte `KORE_DASHBOARD_OPERATOR_SECRET` is required;
    disabled, missing, and invalid credentials all return indistinguishable
    no-store 404s. The version-one aggregate JSON and fixed server-rendered
    HTML expose only all-time/now/paused/sleeping counts plus freshness, while
    failures return a sanitized 503. Unit and production-server integration
    coverage is in `tests/server_dashboard.test.ts` and
    `tests/server_dashboard.integration.test.ts`.

  * **Goal:** Provide a small operator dashboard that shows the four
    authoritative match counts and enough freshness/status information to
    understand them, without exposing players, snapshots, database IDs, or
    replay data.
  * **Target Files:** `server.ts`, `src/server/dashboard.ts`,
    `src/server/gameRegistry.ts`, server configuration
  * **Test File:** `tests/server_dashboard.test.ts`,
    `tests/server_dashboard.integration.test.ts`
  * **Allowed Context:** native Bun static/HTTP routing, `/config` hardening,
    SQLite store, server runtime injection
  * **Commit:** `feat: add minimal server match dashboard`
  * **Required Contract:**

    * Serve one documented JSON metrics endpoint and a minimal server-rendered
      or static dashboard route. Keep the existing static-file allowlist
      narrow; dashboard routes must not turn arbitrary repository files into
      public assets.
    * Protect the dashboard with an operator secret or equivalent deployment
      authentication configured outside tracked source. The public metrics
      endpoint, if one is deliberately retained, exposes aggregate counts only
      and is rate-limited/cached appropriately.
    * Return a schema-versioned response containing the four counts, server
      timestamp, and a defined freshness/consistency note. Invalid credentials,
      malformed configuration, and database failures fail closed without
      leaking stack traces or internal paths.
    * Cover empty, live, paused, sleeping, completed, restored, and rematched
      matches; browser coverage verifies that the visible labels correspond to
      the JSON contract.

* [x] **Task [20.3]: Make Online Matchmaking Loading Visible And Recoverable**

  * **Done:** Network startup now creates an accessible `#network-loading`
    status surface before opening the socket, reports connection,
    matchmaking/waiting-room, and initialization progress, removes itself only
    after validated `INIT`, and turns connection, server, close, or timeout
    failures into retry/back-to-menu controls that close the old socket. The
    production Play Online browser journey asserts the visible loading state
    before the second tab matches; `tests/online_join_menu.test.ts` preserves
    the documented button routing.

  * **Goal:** Replace the apparent no-op after clicking "Play Online" with an
    accessible loading/join screen that remains visible until authoritative
    `INIT` establishes a match or a recoverable error is shown.
  * **Target Files:** `src/menu/Menu.ts`, `src/main.ts`,
    `src/utils/onlineConfig.ts`, network startup/UI helpers
  * **Test File:** `tests/online_loading_state.test.ts`,
    `tests/browser/online_join_loading.e2e.test.ts`
  * **Allowed Context:** `/config` discovery, query URL override, browser
    startup branch, menu scene lifecycle, browser diagnostics harness
  * **Commit:** `feat: show online matchmaking loading state`
  * **Required Contract:**

    * Clicking Play Online immediately gives visible, keyboard-accessible
      feedback for configuration fetch, WebSocket connection, matchmaking, and
      match initialization. Disable duplicate joins while a request is pending.
    * Keep the existing manual `?url=` override and path-prefix-safe config
      behavior. Configuration, connection, timeout, and protocol errors show a
      sanitized retry/back-to-menu action; retry cleans up the old socket and
      cannot create duplicate handlers or lobby entries.
    * Do not start gameplay, accept pointer actions, or show a selected map
      until validated authoritative settings arrive. A completed join replaces
      the loading scene exactly once and disposes it.
    * Test slow config, delayed `INIT`, socket failure, retry, cancellation,
      and two-tab matchmaking through the production browser route.

* [x] **Task [20.4]: Add A Non-Binding Online Map Preference Screen**

  * **Done:** Play Online without an injected callback now opens the existing
    catalog page in online-preference mode, labels the choice as non-binding,
    and passes only the selected catalog ID in the join URL. `LOGIN` accepts an
    optional validated `mapPreference`; matchmaking uses it only when both
    queued players selected the same browser-available, loadable map, otherwise
    it authoritatively loads `ice-map-v1`. `INIT.mapId` exposes the actual map
    selected by the server. Focused protocol/config/menu/browser coverage is
    in `tests/online_map_preference.test.ts`, `tests/online_client_config.test.ts`,
    `tests/online_join_menu.test.ts`, and `tests/browser/browser_startup.e2e.test.ts`.

  * **Goal:** Let an online player choose a map as a matchmaking preference,
    not a final unilateral map decision. The UI must explicitly describe that
    the server may select a compatible map or fall back to the default.
  * **Target Files:** `src/menu/Menu.ts`, `src/server/types.ts`,
    `src/server/runtime.ts`, `src/server/gameRegistry.ts`, map catalog helpers
  * **Test File:** `tests/online_map_preference.test.ts`,
    `tests/browser/online_map_preference.e2e.test.ts`
  * **Allowed Context:** validated browser map catalog, matchmaking protocol,
    authoritative settings construction, local/battle map selection
  * **Commit:** `feat: add online map preferences`
  * **Required Contract:**

    * Reuse catalog map IDs only; the browser never supplies raw map settings.
      Hide blocked, non-browser-available, and incompatible maps, and preserve
      the current local and KI-vs-KI map-selection behavior.
    * Send an optional preference before matchmaking. The server validates it,
      records no untrusted map payload, and chooses a map only by a documented
      compatible-preference policy (for example, both players choose the same
      eligible map); otherwise it chooses the canonical fallback.
    * The loading screen identifies the submitted preference and the final
      initialized scene identifies the actual server-selected map. A changed
      preference only affects a new matchmaking attempt; it cannot change an
      existing game or a rematch without a new authoritative match setup.
    * Treat this as a product experiment: record selection/fallback aggregates
      without player identifiers, add a feature flag/default-off policy if
      deployment needs it, and leave a documented removal path. Do not claim it
      is final map voting or ranked-matchmaking policy.

* [x] **Task [20.5]: Add A Safe In-Match Pause Menu And Report Flow**

  * **Done:** Online clients receive a small pause/report surface after `INIT`.
    Pause and resume both require matching authenticated requests from every
    current match member; the persisted lifecycle state blocks turns/items
    while paused and `PAUSE_STATE` is broadcast to both clients. `REPORT_MATCH`
    derives game membership server-side and writes an immutable UUID report with
    validated category, bounded text, timestamp, and one-report-per-category
    rate limit. Focused coverage: `tests/match_pause_protocol.test.ts` and
    `tests/match_report_protocol.test.ts`.

  * **Goal:** Add a pause-menu surface during online play that lets a player
    request a server pause when supported and submit a report tied to the
    authoritative game ID, without client-side game mutation or disclosure of
    other players' private data.
  * **Target Files:** `src/ui/PauseMenu.ts`, `src/main.ts`,
    `src/server/types.ts`, `src/server/runtime.ts`, `src/server/db.ts`,
    `src/server/gameRegistry.ts`
  * **Test File:** `tests/match_pause_protocol.test.ts`,
    `tests/match_report_protocol.test.ts`,
    `tests/browser/pause_report.e2e.test.ts`
  * **Allowed Context:** authoritative ownership checks, completed-match
    gating, network packet validation, SQLite persistence, scene input
    delegation
  * **Commit:** `feat: add match pause menu and reports`
  * **Required Contract:**

    * The local menu overlay stops only that browser's input; it must not imply
      that network physics or the opponent has paused. If authoritative pause
      is offered, require a documented request/accept/resume policy, broadcast
      its status, persist it, and reject actions for all participants while it
      is active.
    * A report request derives the match reference from the authenticated
      server-side socket/game membership, never from a client-provided database
      ID. Persist an immutable report record with an opaque report ID, created
      time, category, bounded sanitized text, reporter membership, and the
      authoritative game reference.
    * Validate lengths, enum/category values, rate limits, duplicate reports,
      and finished/disconnected-match policy. Do not expose reporter identity,
      raw socket/IP data, snapshots, or arbitrary report queries to players.
    * Confirm success/failure in the pause menu without leaking moderation
      state. Operator access to reports is a separate authenticated endpoint
      and retention/export policy, not an extension of the public dashboard.

* [x] **Task [20.6]: Share And View Immutable Completed-Match Replays**
  * **Done:** Completed-match replay artifacts, opaque revocable public shares,
    result actions, and an isolated no-socket browser viewer are delivered and
    covered by server/security and production-browser tests.

  * **Goal:** After a completed match, offer replay and share actions that
    create a stable public viewer link; a visitor can open the link or paste a
    share ID manually to watch the deterministic replay without joining or
    modifying the original game.
  * **Target Files:** `src/replay/types.ts`, `src/replay/recorder.ts`,
    `src/replay/player.ts`, `src/menu/replayViewer.ts`, `src/ui/MatchResultOverlay.ts`,
    `src/server/db.ts`, `src/server/runtime.ts`, `src/server/types.ts`
  * **Test File:** `tests/shared_match_replay.test.ts`,
    `tests/replay_share_security.test.ts`,
    `tests/browser/shared_replay_viewer.e2e.test.ts`
  * **Allowed Context:** versioned replay document, authoritative accepted
    actions, existing replay viewer, completed-match result overlay, browser
    clipboard APIs
  * **Delivery:** Complete the following ordered atomic subtasks. The parent is
    complete only after every subtask is `[x]`.
  * **Required Contract:**

    * Freeze the replay only after authoritative match completion and persist
      its initial settings, seed, accepted action history, version, and final
      result as an immutable validated artifact. Replaying it must reproduce
      the recorded final snapshot/result and must never attach to a live
      `GameHandler` or accept live gameplay input.
    * Generate a revocable opaque share token distinct from the internal game
      ID. A public share URL resolves only that replay's deliberately public
      metadata and replay payload; it reveals no reports, player account data,
      socket data, database IDs, or active game state. Unknown, revoked,
      malformed, oversized, and incompatible tokens render a safe error.
    * The match-result overlay provides **Replay** and **Share**. Share copies
      the canonical viewer URL only after an explicit user gesture, gives a
      visible fallback when clipboard write is unavailable, and does not make
      a completed replay public without the user's share action/policy consent.
    * The replay viewer offers a visible share-ID input and a separate
      user-gesture **Paste from clipboard** action. Clipboard permission
      failures leave typed input intact and explain how to paste manually; no
      automatic clipboard reads occur on page load.
    * Browser E2E covers result -> share -> copied/manual URL -> viewer ->
      deterministic playback, direct token navigation, manual typed ID, denied
      clipboard permission, invalid token, and verifies that viewer controls
      cannot send `SHOOT`, `USE_ITEM`, `REMATCH`, pause, or report packets.

  * [x] **Task [20.6.0]: Serialize Every Registered System With A Stable Identity**
    * **Done:** Engine snapshots now carry stable-ID system settings and their
      explicit tick order. The allowlisted factory rejects malformed, duplicate,
      executable, unsupported-version, and unknown system settings; handler
      restoration rebuilds core and deterministic browser adapters without
      retaining live emitter/canvas references. Focused round-trip coverage
      proves JSON-identical restored snapshots and mid-playback continuation.
    * **Goal:** Before continuing replay sharing, make systems reconstructible
      from snapshot data just like players: every system installed on a handler
      has a stable unique ID and a versioned settings object, and
      `new System(settings).toSettings()` is semantically identical to the
      original system snapshot.
    * **Target Files:** `src/systems/types.ts`, `src/engine/types.ts`,
      `src/engine/Handler.ts`, all concrete `src/systems/*.ts`, system factory
      registry, and snapshot contracts
    * **Test File:** `tests/system_settings_roundtrip.test.ts`,
      `tests/system_snapshot_restore.test.ts`,
      `tests/system_id_stability.test.ts`
    * **Commit:** `feat: serialize stable system settings`
    * **Required Contract:**

      * Define and export `ISettingsSerialize<T>` for systems, with
        `toSettings(): T`, and require every registered system to expose a
        stable `systemId` and schema version. IDs must be explicit stable
        protocol constants (optionally documented with a name/constructor hash
        for diagnostics), not runtime constructor names, minifier output, array
        position, or random values.
      * Add one allowlisted system settings union and factory. Unknown IDs,
        duplicate IDs, wrong versions, malformed settings, and unsupported
        executable values fail at the snapshot boundary; never silently replace
        an unknown system with an unrelated default.
      * Serialize all deterministic state that affects future ticks, including
        playback counters/final sync, physics contact lifecycle, winning
        pending state, AI decision state, and any map/system configuration.
        Browser-only listener/canvas/DOM references remain non-serialized
        adapters, but their deterministic configuration is serialized.
      * `GameHandler.toSettings()` exports system settings in deterministic ID
        order; `GameHandlerBuilder.fromSettings()` restores through the factory
        without double-registering default systems. Preserve registration/tick
        order as an explicit serialized order field while rejecting duplicate
        IDs.
      * Round-trip every concrete system alone and in a handler, restore a
        mid-playback/mid-contact/mid-win snapshot, and prove uninterrupted and
        restored execution have equal final engine snapshots. Add a collision
        test for two classes with similar names to prove IDs remain unique.

  * [x] **Task [20.6.1]: Persist Frozen Replay Shares**
    * **Done:** Completed authoritative matches can freeze a validated replay
      document with its final completed snapshot/result in SQLite. The opaque
      token and copied payload are immutable, and the persistence boundary
      rejects non-completed matches and duplicate frozen shares.
    * **Goal:** Add a versioned SQLite share record which can be created only
      from a completed authoritative match and contains an immutable validated
      replay/final-result payload plus a revocable opaque token.
    * **Target Files:** `src/server/db.ts`, `src/server/gameRegistry.ts`,
      `src/replay/types.ts`
    * **Test File:** `tests/shared_match_replay.test.ts`
    * **Commit:** `feat: persist immutable replay shares`


  * [x] **Task [20.6.2]: Expose Public Replay-Share Retrieval Safely**
    * **Done:** `GET /replays/<32-hex-token>` is an anonymous, read-only,
      no-store route. It returns only public replay data and a uniform safe
      error for malformed, unknown, revoked, oversized, or invalid payloads;
      it omits database IDs, users, reports, and frozen final snapshots.
    * **Goal:** Add an exact public read-only token route that returns only the
      replay payload/public metadata and rejects revoked, malformed, unknown,
      oversized, or incompatible tokens without leaking game/report/player IDs.
    * **Target Files:** `server.ts`, `src/server/runtime.ts`,
      `src/server/types.ts`
    * **Test File:** `tests/replay_share_security.test.ts`
    * **Commit:** `feat: serve public replay shares`

  * [x] **Task [20.6.3]: Add Result Replay And Share Actions**
    * **Done:** Completed result overlays expose Replay and Share actions. They
      request an authenticated completed-match share token, then display the
      canonical viewer URL with an explicit Copy button and selectable manual
      fallback; clipboard writes are never attempted until that button gesture.
    * **Goal:** Add explicit completed-result Replay/Share actions; Share asks
      the authoritative server for a token and copies only the canonical viewer
      URL after a user gesture, with a visible non-clipboard fallback.
    * **Target Files:** `src/ui/MatchResultOverlay.ts`, `src/main.ts`,
      network emitter/UI helpers
    * **Test File:** `tests/shared_match_replay.test.ts`
    * **Commit:** `feat: add replay result actions`

  * [x] **Task [20.6.4]: Build The Isolated Share Viewer And Clipboard Entry**
    * **Done:** `?replay=<token>` starts a separate, socket-free read-only
      viewer. Visitors can type an ID or press the explicit Paste button;
      clipboard denial preserves their typed value and shows a manual-paste
      recovery message. Viewer replay handlers have no mouse/network emitter.
    * **Goal:** Let visitors load a share URL, type a share token, or press an
      explicit paste button; replay playback is read-only and never connects to
      a live gameplay socket.
    * **Target Files:** `src/menu/replayViewer.ts`, `src/main.ts`
    * **Test File:** `tests/replay_share_security.test.ts`,
      `tests/browser/shared_replay_viewer.e2e.test.ts`
    * **Commit:** `feat: add replay share viewer`

  * [x] **Task [20.6.5]: Verify The Replay-Sharing Journey**
    * **Done:** Production-browser coverage loads a frozen share by direct URL
      and manual ID, proves denied-clipboard recovery and invalid-token safety,
      and observes that the isolated viewer opens no WebSocket. Revocation and
      public-payload privacy remain covered by the focused security suite.
    * **Goal:** Prove the completed-match -> share -> URL/manual/paste viewer
      path, clipboard-denial recovery, revocation, and no-live-action boundary
      in the production browser.
    * **Target Files:** browser replay harness and `step-by-step.md`
    * **Test File:** `tests/browser/shared_replay_viewer.e2e.test.ts`
    * **Commit:** `test: verify replay sharing journey`

* [ ] **Task [20.7]: Qualify The Online Operations Journey**

  * **Goal:** Prove the dashboard, online loading, tentative map preference,
    pause/report, and shared replay features compose safely with authoritative
    gameplay, reconnect persistence, and the existing browser diagnostics
    workflow.
  * **Target Files:** `docs/release-verification.md`, `requirements.md`,
    `AGENTS.md`, `step-by-step.md`, server/browser test harnesses
  * **Test File:** `tests/online_operations_gate.test.ts`,
    `tests/browser/online_operations_journey.e2e.test.ts`
  * **Allowed Context:** Sections 8, 12, 16, 18, and Tasks 20.1–20.6
  * **Commit:** `test: qualify online operations journey`
  * **Required Journey:**

    * obtain protected dashboard metrics for created, live, paused, sleeping,
      completed, evicted, and restored games;
    * enter online play through a delayed loading state and a submitted map
      preference, then verify the server-selected map;
    * open/close the local pause menu, exercise the agreed authoritative pause
      policy, submit one validated report, and prove invalid report attempts
      do not alter game state;
    * complete a match, create a share link, load it in an isolated browser
      context by URL and manual/paste ID, and verify replay equality;
    * verify that reports, dashboard authentication, share tokens, clipboard
      failures, retries, reconnects, and malformed packets neither leak data
      nor create duplicate matches/handlers.
  * **Required Commands:** `bun test`, `npx tsc --noEmit`, `bun run build`,
    `bun run test:browser:full`, and focused server/browser tests from this
    chapter.
  * **Release Rule:** Dashboard metrics, report records, and replay sharing are
    operational features, not a substitute for the Section 15 human-playtest
    evidence. Do not mark a map preference experiment, pause policy, or public
    replay feature as qualified without the explicit tests, privacy review,
    and documented deployment configuration above.

### Database-Backed Immutable Map Definitions Checklist

* [x] Add a versioned `StoredMap` database schema with immutable UUID `id`,
  declarative `MapDocument`, `draft`/`approved`/`retired` status, content hash,
  and creation/approval timestamps. Commit: `feat: persist immutable map documents`

  * Do not store or execute arbitrary code. Every changed map receives a new
    UUID; approved IDs are never modified, reused, or deleted.
  * **Done:** `GameDatabase` stores validated immutable map revisions, hashes
    canonical document data, supports draft approval and retirement without
    content mutation, and returns defensive document copies.

* [x] Add a `MapRepository` that loads only approved IDs for new matchmaking,
  validates schema/fields/numbers/geometry/spawns/hazards/team layouts/hash,
  and converts through `validateMapDocument()` then `loadMapDocument()`.
  Commit: `feat: load approved database maps`

  * **Done:** The server-only repository selects only approved immutable
    documents and converts defensive copies through the canonical map loader;
    draft and retired IDs remain unreadable to new matchmaking.

* [x] Make authoritative matchmaking expand a requested map ID server-side into
  `GameSettings` and a `GameHandler`/ECS runtime. Clients may request an ID but
  may not submit authoritative map documents or `EngineSettings`; authenticated
  server construction assigns player IDs. Commit: `feat: select authoritative database maps`

  * **Done:** `ServerRuntime` optionally uses `MapRepository` for map
    preference validation and fallback selection, while `GameRegistry` expands
    the approved ID server-side before creating the authoritative handler.

* [x] Persist `{ mapId, contentHash }` and the expanded map state in every
  `EngineSettings` match snapshot. Existing matches, reconnects, rollback, and
  replays must retain their original immutable map even after a new revision is
  approved. Retired maps remain readable for these old records but are hidden
  from new matchmaking. Commit: `feat: retain immutable match map references`

  * **Done:** Database-map settings carry an immutable map reference through
    handler and SQLite snapshots. A retired revision remains restorable from an
    existing match snapshot but cannot create a new match.

* [x] Add cache revision/invalidation to expose newly approved database maps to
  new matches without an engine/framework restart. Existing handlers must not
  be mutated by refresh. Commit: `feat: refresh database map registry`

  * **Done:** `MapRepository` caches defensive approved-map copies and exposes
    an explicit monotonic `refresh()` revision. Newly approved/retired records
    become visible only to future lookups after refresh; already expanded match
    settings remain unchanged.

* [x] Add focused coverage proving approved-map loading; draft/retired selection
  rejection; malformed document, unsupported hazard, and hash rejection; UUID
  replacement for revisions; cache refresh; immutable old matches; persisted
  map reference restoration; and client map/ECS authority rejection.
  Commit: `test: validate immutable database maps`

  * **Done:** Store, repository, authoritative preference, cache, persistence,
    and runtime-boundary tests cover these acceptance cases. Client `CREATE_GAME`
    payloads no longer admit arbitrary authoritative settings.
