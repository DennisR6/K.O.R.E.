# Slipstrike Step-by-Step Execution Checklist

## How To Use This Checklist

- `[ ]` means planned and not started.
- `[v]` means actively being worked on. Keep exactly one task at this state.
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
- [ ] Repair the editor's missing imports and undefined function references.
  Expected scope: one editor module and test. Commit: `fix: restore editor imports`.
- [ ] Replace duplicate editor element IDs with unique identifiers and update
  their references. Expected scope: editor markup and one script. Commit:
  `fix: use unique editor element ids`.
- [ ] Implement the editor temporary-save action with validated map data.
  Expected scope: editor save module and test. Commit: `feat: save temporary editor maps`.
- [ ] Replace the editor's hard-coded preview address with configurable current
  origin behavior. Expected scope: preview module and test. Commit:
  `fix: configure editor preview address`.

## 5. Item Framework And Official Items

- [ ] Define versioned item, inventory, pickup, target, duration, and use-limit
  schemas. Expected scope: item types and validation test. Commit:
  `feat: define item data schema`.
- [ ] Add a strict item validator with an effect-type whitelist and no executable
  script fields. Expected scope: validator and rejection tests. Commit:
  `feat: validate declarative items`.
- [ ] Add an item loader that registers built-in and local mod items through the
  same validation path. Expected scope: loader and test. Commit:
  `feat: load declarative items`.
- [ ] Add per-mode item-economy settings supporting fixed loadouts, map pickups,
  and seeded random draws. Expected scope: settings contract and test. Commit:
  `feat: configure item economy`.
- [ ] Implement fixed loadout initialization and use consumption. Expected
  scope: inventory system and test. Commit: `feat: initialize fixed item loadouts`.
- [ ] Implement deterministic seeded item draws and serialize draw state for
  replay and reconnect. Expected scope: draw system and test. Commit:
  `feat: add deterministic item draws`.
- [ ] Implement map item pickups and validate active-team ownership. Expected
  scope: pickup system and test. Commit: `feat: collect map item pickups`.
- [ ] Implement item target validation for entity, position, and zone targets.
  Expected scope: target validator and test. Commit: `feat: validate item targets`.
- [ ] Implement authoritative item-use packets and reject use outside the item
  phase or by the wrong team. Expected scope: server protocol and test. Commit:
  `feat: authorize item use`.
- [ ] Implement local item-use emission and authoritative client state updates.
  Expected scope: emitter/UI adapter and test. Commit: `feat: synchronize item use`.
- [ ] Add the serializable `modifyForce` effect primitive and test stacking.
  Expected scope: effect and test. Commit: `feat: add modify force effect`.
- [ ] Add the serializable `modifyRotation` effect primitive and test angle
  normalization. Expected scope: effect and test. Commit: `feat: add modify rotation effect`.
- [ ] Add the serializable `lockRotation` effect primitive and test expiration.
  Expected scope: effect and test. Commit: `feat: add lock rotation effect`.
- [ ] Add the serializable `applyTorque` effect primitive and test deterministic
  angular updates. Expected scope: effect and test. Commit: `feat: add torque effect`.
- [ ] Add the serializable `spawnTrigger` effect primitive and test snapshot
  restoration. Expected scope: effect and test. Commit: `feat: add spawn trigger effect`.
- [ ] Add the serializable delayed-effect primitive and test fixed-tick timing.
  Expected scope: scheduler effect and test. Commit: `feat: add delayed effect`.
- [ ] Add the serializable shield effect primitive and test damage/collision
  interaction. Expected scope: effect and test. Commit: `feat: add shield effect`.
- [ ] Add the serializable freeze effect primitive and test movement reduction
  and expiration. Expected scope: effect and test. Commit: `feat: add freeze effect`.
- [ ] Add a reusable teleport/swap effect primitive and test invalid target
  rejection. Expected scope: effect and test. Commit: `feat: add swap position effect`.
- [ ] Add a reusable temporary-wall effect primitive and test structure cleanup.
  Expected scope: effect and test. Commit: `feat: add temporary wall effect`.
- [ ] Add the Anker item data and behavior for configurable knockback reduction.
  Expected scope: item JSON and behavior test. Commit: `feat: add anker item`.
- [ ] Add the Durchlaessigkeit item data and behavior for temporary ghost-mode
  collision filtering. Expected scope: item JSON and behavior test. Commit:
  `feat: add ghost mode item`.
- [ ] Add the Magnet item data and behavior for configurable attraction or
  repulsion. Expected scope: item JSON and behavior test. Commit: `feat: add magnet item`.
- [ ] Add the Falltuer item data and behavior that spawns a kill-zone trigger.
  Expected scope: item JSON and behavior test. Commit: `feat: add trapdoor item`.
- [ ] Add the Power-Dash item data and behavior for configured force or friction
  modification. Expected scope: item JSON and behavior test. Commit:
  `feat: add power dash item`.
- [ ] Add the Verzoegerte-Mine item data and behavior for delayed force
  explosion. Expected scope: item JSON and behavior test. Commit:
  `feat: add delayed mine item`.
- [ ] Add the Mini-Wall item data and behavior for a temporary portable wall.
  Expected scope: item JSON and behavior test. Commit: `feat: add mini wall item`.
- [ ] Add the Freeze-Shot item data and behavior for temporary slowing. Expected
  scope: item JSON and behavior test. Commit: `feat: add freeze shot item`.
- [ ] Add the Switch item data and behavior for validated figure-position swaps.
  Expected scope: item JSON and behavior test. Commit: `feat: add switch item`.
- [ ] Add the Jaegermeister-Elixier item data and behavior that prevents an
  opponent figure from being selected for its duration. Expected scope: item
  JSON and behavior test. Commit: `feat: add selection lock item`.
- [ ] Add the Vodka-Zero item data and seeded deterministic aim variance.
  Expected scope: item JSON and replay test. Commit: `feat: add deterministic aim variance item`.
- [ ] Add item stacking, conflict, cleanup, serialization, and replay regression
  tests for mixed effect combinations. Expected scope: focused integration test.
  Commit: `test: cover item effect interactions`.

## 6. Input, UI, And Accessibility

- [ ] Define configurable action bindings for aim, charge, push, and item use.
  Expected scope: input contracts and test. Commit: `feat: define configurable actions`.
- [ ] Separate aim rotation selection from power charging in the UI input model.
  Expected scope: UI system and test. Commit: `feat: separate aim and charge input`.
- [ ] Add explicit item-phase UI with available items, valid targets, and skip
  behavior. Expected scope: UI system and browser test. Commit: `feat: add item phase interface`.
- [ ] Add clear active-team, rule-phase, turn number, force, and selected-item
  indicators. Expected scope: drawing system and test. Commit: `feat: show match state indicators`.
- [ ] Add controller stick/trigger bindings through the action abstraction.
  Expected scope: controller adapter and test. Commit: `feat: add controller input`.
- [ ] Add touch drag-and-hold bindings through the action abstraction. Expected
  scope: touch adapter and browser test. Commit: `feat: add touch input`.
- [ ] Add responsive mobile layout rules with large touch targets and verify a
  small viewport browser path. Expected scope: UI styling and test. Commit:
  `feat: adapt interface for mobile`.
- [ ] Add desktop and Steam Deck layout scaling for compact and large displays.
  Expected scope: renderer layout and test. Commit: `feat: scale interface for desktop`.
- [ ] Fix p5 wheel handler binding and remove dependence on the browser-created
  `defaultCanvas0` global. Expected scope: main input setup and browser test.
  Commit: `fix: stabilize canvas input handlers`.

## 7. AI And Play Modes

- [ ] Define serializable AI configuration including seed, difficulty, and
  decision limits. Expected scope: AI types and test. Commit: `feat: define ai settings`.
- [ ] Add a shared AI turn-emitter interface that submits the same validated
  input as a human player. Expected scope: AI adapter and test. Commit:
  `feat: add ai turn interface`.
- [ ] Implement and test deterministic easy AI random angle and force choices.
  Expected scope: easy strategy and test. Commit: `feat: add deterministic easy ai`.
- [ ] Implement medium AI target-angle heuristics with collision and
  out-of-bounds risk penalties. Expected scope: strategy and test. Commit:
  `feat: add heuristic medium ai`.
- [ ] Implement hard AI bounded angle/force simulation search with a fixed
  deterministic evaluation budget. Expected scope: strategy and test. Commit:
  `feat: add simulation hard ai`.
- [ ] Add 1-player-versus-AI game-mode settings and initialize the AI team from
  those settings. Expected scope: mode setup and test. Commit: `feat: add versus ai mode`.
- [ ] Run AI through the authoritative turn path and add a complete simulated
  match regression test. Expected scope: registry or rule adapter and test.
  Commit: `test: cover authoritative ai match`.

## 8. Persistence, Sharing, And Replays

- [ ] Define a versioned local save-slot record containing validated game
  settings and match snapshot. Expected scope: save types and test. Commit:
  `feat: define local save slots`.
- [ ] Implement local save-slot creation and listing without exposing database
  files to static HTTP routes. Expected scope: storage adapter and test. Commit:
  `feat: save local matches`.
- [ ] Implement local save-slot restoration through the same settings validator
  used by networking. Expected scope: loader and test. Commit: `feat: restore local matches`.
- [ ] Define a portable `toSettings()` export envelope with schema version and
  validation metadata. Expected scope: export helper and test. Commit:
  `feat: version game settings exports`.
- [ ] Add an authoritative create-or-join path that accepts only validated,
  allowed settings exports and distributes them in `INIT`. Expected scope:
  registry/runtime and test. Commit: `feat: share validated game settings`.
- [ ] Define a replay document containing initial settings, deterministic seed,
  accepted actions, and format version. Expected scope: replay types and test.
  Commit: `feat: define replay format`.
- [ ] Record accepted local actions into replay data and test export/replay
  equality. Expected scope: local emitter and test. Commit: `feat: record local replays`.
- [ ] Record accepted authoritative actions into replay data and persist it with
  the match. Expected scope: registry/database and test. Commit:
  `feat: record network replays`.
- [ ] Implement replay playback from initial settings without live input and
  test final snapshots. Expected scope: replay player and test. Commit:
  `feat: play deterministic replays`.
- [ ] Add a replay viewer entry point and a malformed/incompatible replay error
  state. Expected scope: menu/UI and browser test. Commit: `feat: add replay viewer`.

## 9. Desktop, Mobile, And Discord

- [ ] Add Tauri project configuration and a minimal desktop launch command that
  serves the existing built browser application. Expected scope: Tauri config
  and package scripts. Commit: `build: add tauri desktop shell`.
- [ ] Verify desktop packaging reads no development-only paths and document the
  release build procedure. Expected scope: package config and documentation.
  Commit: `docs: document desktop build`.
- [ ] Add web-app manifest, icons, and service-worker caching for offline mobile
  launch. Expected scope: public assets and registration code. Commit:
  `feat: add offline mobile web shell`.
- [ ] Verify offline startup, reconnect recovery, and touch controls on a mobile
  viewport; add a browser smoke test. Expected scope: test and minor fixes.
  Commit: `test: cover mobile offline flow`.
- [ ] Define environment-configured Discord integration settings with no client
  credentials committed. Expected scope: config types and test. Commit:
  `feat: configure discord integration`.
- [ ] Add Discord Rich Presence states for menu, match, map, and active turn
  behind the configured integration. Expected scope: adapter and mock test.
  Commit: `feat: report discord match presence`.
- [ ] Add Discord join/invite payload handling that validates game identifiers
  before connecting. Expected scope: adapter and test. Commit:
  `feat: support discord game invites`.
- [ ] Document required Discord application configuration and verify disabled
  integration is a no-op. Expected scope: documentation and test. Commit:
  `docs: document discord configuration`.

## 10. Final Hardening And Release Readiness

- [ ] Add end-to-end coverage for a local match with items, hazards, elimination,
  result, reset, and replay. Expected scope: integration test. Commit:
  `test: cover complete local match`.
- [ ] Add end-to-end coverage for a network match with item authority,
  disconnect/reconnect, result, and replay persistence. Expected scope:
  runtime test. Commit: `test: cover complete network match`.
- [ ] Add malformed schema, invalid packet, and unauthorized action fuzz-style
  regression cases. Expected scope: validator/runtime tests. Commit:
  `test: harden untrusted game inputs`.
- [ ] Audit every game-data boundary to ensure external content cannot execute
  code or bypass the effect whitelist. Expected scope: validator changes and
  security tests. Commit: `fix: harden declarative mod loading`.
- [ ] Remove obsolete commented prototypes and duplicate paths only after their
  replacement coverage is complete. Expected scope: one focused removal set and
  test updates. Commit: `refactor: remove obsolete game prototypes`.
- [ ] Update `AGENTS.md`, `TODO.md`, GDD implementation notes, and this checklist
  to reflect the completed feature set. Expected scope: documentation only.
  Commit: `docs: document completed game systems`.
- [ ] Run clean-install, unit, typecheck, browser-build, server, desktop, and
  mobile smoke checks; record exact results in release documentation. Expected
  scope: release checklist/documentation. Commit: `docs: record release verification`.
