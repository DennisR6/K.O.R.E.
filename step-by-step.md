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
- [ ] **Task [12.11]: Harden The Effect Factory Against Unknown Types**
  - **Goal:** Make `MetaEffect` reject or explicitly handle unknown effect types instead of silently falling back to movement, and cover the missing freeze/shield/ghost/multi serialized cases with round-trip tests.
  - **Target Files:** `src/effects/effects.ts`
  - **Test File:** `tests/effect_factory_roundtrip.test.ts`
  - **Allowed Context:** `src/effects/*.ts`, `src/entity/Player.ts`
  - **Commit:** `fix: harden effect factory against unknown types`
- [ ] **Task [12.12]: Deterministic AI-Vs-AI Game-Fuzz Suite**
  - **Goal:** Ship a deterministic AI-vs-AI fuzz harness (`tests/support/aiMatchFuzz.ts`) with per-match/per-turn invariants, negative-action injection, repeat-same-case determinism, replay/persistence/rematch verification, and `RC_GAME_COUNT`-controlled smoke/RC/soak runs wired into package scripts.
  - **Target Files:** `package.json`
  - **Test File:** `tests/ai_match_fuzz.test.ts`
  - **Allowed Context:** `tests/support/aiMatchFuzz.ts`, `src/ai/*.ts`, `src/engine/Handler.ts`, `src/emitter/EngineEmitter.ts`
  - **Commit:** `test: add deterministic ai match fuzz suite`
- [ ] **Task [12.13]: Qualify The Release Candidate**
  - **Goal:** Run the full release-candidate gate (clean install, unit suite, typecheck, build, RC fuzz run, desktop build), record the 24-point report in `docs/release-verification.md`, and update `requirements.md`, `AGENTS.md`, and this checklist.
  - **Target Files:** `docs/release-verification.md`, `requirements.md`, `AGENTS.md`, `package.json`
  - **Test File:** `tests/release_candidate_gate.test.ts`
  - **Allowed Context:** everything in this repository
  - **Commit:** `docs: qualify release candidate`
