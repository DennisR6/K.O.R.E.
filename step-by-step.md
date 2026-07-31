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
- [ ] **Task [7.4]: Heuristic Medium AI**
  - **Goal:** Implement medium AI target-angle heuristics with collision and out-of-bounds risk penalties.
  - **Target Files:** `src/ai/mediumAi.ts`, `src/ai/types.ts`
  - **Test File:** `tests/medium_ai.test.ts`
  - **Allowed Context:** `src/physics/physics.ts`, `src/ai/types.ts`
  - **Commit:** `feat: add heuristic medium ai`
- [ ] **Task [7.5]: Simulation Hard AI**
  - **Goal:** Implement hard AI bounded angle/force simulation search with a fixed deterministic evaluation budget.
  - **Target Files:** `src/ai/hardAi.ts`, `src/ai/types.ts`
  - **Test File:** `tests/hard_ai.test.ts`
  - **Allowed Context:** `src/engine/Handler.ts`, `src/ai/types.ts`
  - **Commit:** `feat: add simulation hard ai`
- [ ] **Task [7.6]: Versus AI Game Mode**
  - **Goal:** Add 1-player-versus-AI game-mode settings and initialize the AI team from those settings.
  - **Target Files:** `src/settings/settings.ts`, `src/engine/Handler.ts`
  - **Test File:** `tests/versus_ai.test.ts`
  - **Allowed Context:** `src/settings/settings.ts`, `src/engine/Handler.ts`
  - **Commit:** `feat: add versus ai mode`
- [ ] **Task [7.7]: Authoritative AI Match Coverage**
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
  - **Target Files:** `tests/e2e_local_match.test.ts`, `src/engine/Handler.ts`
  - **Test File:** `tests/e2e_local_match.test.ts`
  - **Allowed Context:** `src/engine/Handler.ts`, `src/item/officialItems.ts`
  - **Commit:** `test: cover complete local match`
- [x] **Task [10.2]: Cover Complete Network Match**
  - **Goal:** Add end-to-end coverage for a network match with item authority, disconnect/reconnect, result, and replay persistence.
  - **Target Files:** `tests/e2e_network_match.test.ts`, `src/server/gameRegistry.ts`
  - **Test File:** `tests/e2e_network_match.test.ts`
  - **Allowed Context:** `src/server/gameRegistry.ts`, `src/server/runtime.ts`
  - **Commit:** `test: cover complete network match`
- [ ] **Task [10.3]: Harden Untrusted Game Inputs**
  - **Goal:** Add malformed schema, invalid packet, and unauthorized action fuzz-style regression cases.
  - **Target Files:** `tests/input_fuzz.test.ts`, `src/server/gameRegistry.ts`
  - **Test File:** `tests/input_fuzz.test.ts`
  - **Allowed Context:** `src/server/gameRegistry.ts`, `src/item/validate.ts`
  - **Commit:** `test: harden untrusted game inputs`
- [ ] **Task [10.4]: Harden Declarative Mod Loading**
  - **Goal:** Audit every game-data boundary to ensure external content cannot execute code or bypass the effect whitelist.
  - **Target Files:** `src/item/validate.ts`, `src/contracts/documents.ts`
  - **Test File:** `tests/mod_security.test.ts`
  - **Allowed Context:** `src/item/validate.ts`, `src/contracts/documents.ts`
  - **Commit:** `fix: harden declarative mod loading`
- [ ] **Task [10.5]: Remove Obsolete Game Prototypes**
  - **Goal:** Remove obsolete commented prototypes and duplicate paths only after their replacement coverage is complete.
  - **Target Files:** `src/start.ts`, `src/ui/Mouse.ts`
  - **Test File:** `tests/cleanup.test.ts`
  - **Allowed Context:** `src/main.ts`, `src/start.ts`
  - **Commit:** `refactor: remove obsolete game prototypes`
- [ ] **Task [10.6]: Document Completed Game Systems**
  - **Goal:** Update `AGENTS.md`, `TODO.md`, GDD implementation notes, and this checklist to reflect the completed feature set.
  - **Target Files:** `AGENTS.md`, `TODO.md`
  - **Test File:** `tests/documentation.test.ts`
  - **Allowed Context:** `AGENTS.md`, `TODO.md`
  - **Commit:** `docs: document completed game systems`
- [ ] **Task [10.7]: Record Release Verification**
  - **Goal:** Run clean-install, unit, typecheck, browser-build, server, desktop, and mobile smoke checks; record exact results in release documentation.
  - **Target Files:** `docs/release-verification.md`, `package.json`
  - **Test File:** `tests/release_smoke.test.ts`
  - **Allowed Context:** `package.json`
  - **Commit:** `docs: record release verification`
