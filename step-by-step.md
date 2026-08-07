# KORE Delivery Roadmap

This file is the compact, append-only milestone index for completed and planned
KORE work. Current source, verified tests, and `git log --oneline` remain
authoritative.

The table replaces the previous repeated milestone sections so that an agent can
update one row instead of rewriting the document. Detailed implementation
checklists belong in the linked `steps/*.md` files.

## Status Convention

| Marker | Meaning |
|---|---|
| `[ ]` | Planned; implementation has not started. |
| `[-]` | In progress; completion evidence is not yet sufficient. |
| `[x]` | Completed, verified, and committed. |
| `BLOCKED` | Engineering is complete or ready, but an external dependency or human-evidence gate remains. |

## Milestones

| # | Status | Branch | Commit | Step file | Milestone | Scope / completion evidence |
|---:|:---:|---|---|---|---|---|
| 1 | `[x]` | — | `e89cfaf` | [`steps/01-baseline_and_architecture.md`](steps/01-baseline_and_architecture.md) | Baseline And Architecture | Hybrid ECS/OOP lifecycle, deterministic settings snapshots, and the data-defined rules boundary. |
| 2 | `[x]` | — | `3acd06e` | [`steps/02-deterministic_physics_and_arena_safety.md`](steps/02-deterministic_physics_and_arena_safety.md) | Deterministic Physics And Arena Safety | Deterministic movement/collision safety, containment elimination, and fixed-frame regression coverage. |
| 3 | `[x]` | — | `3acd06e` | [`steps/03-match_rules_and_round_lifecycle.md`](steps/03-match_rules_and_round_lifecycle.md) | Match Rules And Round Lifecycle | Serialized rule phases, item turns, active-team progression, match results, and rematches. |
| 4 | `[x]` | — | `0f9afbe` | [`steps/04-data_contracts_mods_and_maps.md`](steps/04-data_contracts_mods_and_maps.md) | Data Contracts, Mods, And Maps | Versioned validators for game/map/item documents, canonical maps, hazards, and safe editor conversion. |
| 5 | `[x]` | — | `32f0175` | [`steps/05-item_framework_and_official_items.md`](steps/05-item_framework_and_official_items.md) | Item Framework And Official Items | Declarative item validation, inventories, deterministic draws/pickups, targets, and official-item coverage. |
| 6 | `[x]` | — | `4734a09` | [`steps/06-input_ui_and_accessibility.md`](steps/06-input_ui_and_accessibility.md) | Input, UI, And Accessibility | Drag-to-shoot input, item controls, gameplay feedback, responsive canvas behavior, and result actions. |
| 7 | `[x]` | — | `bd0b630` | [`steps/07-ai_and_play_modes.md`](steps/07-ai_and_play_modes.md) | AI And Play Modes | Deterministic Easy/Medium/Hard KI, KI-vs-KI battles, and human 1-vs-KI difficulty/map flow. |
| 8 | `[x]` | — | `2ed9a23` | [`steps/08-persistence_sharing_and_replays.md`](steps/08-persistence_sharing_and_replays.md) | Persistence, Sharing, And Replays | Snapshot persistence, immutable replay shares, public replay viewing, base-path-safe URLs, and animated playback. |
| 9 | `[x]` | — | `12d7157` | [`steps/09-desktop_mobile_and_discord.md`](steps/09-desktop_mobile_and_discord.md) | Desktop, Mobile, And Discord | Supported packaging, PWA/offline, and optional Discord integration boundaries with automated contracts. |
| 10 | `[x]` | — | `ff31f4a` | [`steps/10-final_hardening_and_release_readiness.md`](steps/10-final_hardening_and_release_readiness.md) | Final Hardening And Release Readiness | Security, cleanup, malformed-input, lifecycle, and documentation hardening coverage. |
| 11 | `[x]` | — | `87c7f64` | [`steps/11-cross_system_validation.md`](steps/11-cross_system_validation.md) | Cross-System Validation | Snapshot isolation, simulation parity, replay/persistence continuation, winner composition, item-effect state, and uniform invalid-action rejection. Evidence: `tests/cross_system_validation_smoke.test.ts` and referenced suites. |
| 12 | `[x]` | — | `bc4b29a` | [`steps/12-engine_defect_hardening_and_release_candidate_qualification.md`](steps/12-engine_defect_hardening_and_release_candidate_qualification.md) | Engine Defect Hardening And Release Candidate Qualification | Completion/status/effect-factory hardening and deterministic AI fuzz smoke/RC/soak workflows. Evidence: `tests/release_candidate_gate.test.ts`, `tests/ai_match_fuzz.test.ts`, `docs/release-verification.md`. |
| 13 | `[x]` | — | `3acd06e` | [`steps/13-physics_solver_hardening_and_continuous_collision_qualification.md`](steps/13-physics_solver_hardening_and_continuous_collision_qualification.md) | Physics Solver Hardening And Continuous Collision Qualification | Depenetration, contact lifecycle continuity, CCD, energy/rest invariants, bounded contacts, and deterministic physics fuzzing. Evidence: `tests/physics_qualification_gate.test.ts`, `docs/physics-contract.md`. |
| 14 | `[x]` | — | `a9ad011` | [`steps/14-playable_vertical_slice_and_gameplay_integration.md`](steps/14-playable_vertical_slice_and_gameplay_integration.md) | Playable Vertical Slice And Gameplay Integration | Canonical local gameplay, effects, winner evaluation, result overlay, rematch, and menu return flow. |
| 15 | `[x]` | — | `a9ad011` | [`steps/15-gameplay_qualification_and_human_playtest_validation.md`](steps/15-gameplay_qualification_and_human_playtest_validation.md) | Gameplay Qualification And Human Playtest Validation | Automated matrix, fairness, pacing, agency, item, replay, and package evidence complete. No confirmed technical or deterministic playtest defects. Human playtest evidence remains `BLOCKED / PENDING`; no external tester session exists. Guardrail: subjective preference is not a technical invariant. Evidence: `tests/gameplay_release_gate.test.ts`, `tests/human_playtest_readiness.test.ts`, `tests/playtest_evidence_gate.test.ts`, `tests/playtest_regressions.test.ts`, `tests/playtest_build_gate.test.ts`. |
| 16 | `[x]` | — | `b71a7ba` | [`steps/16-real_browser_gameplay_verification.md`](steps/16-real_browser_gameplay_verification.md) | Real Browser Gameplay Verification | Production-bundle startup, menu, local turn, match flow, diagnostics, map catalog, and console-policy E2E coverage. Evidence: `tests/browser/browser_release_gate.test.ts`. |
| 17 | `[x]` | — | `c5a44dc` | [`steps/17-qualified_map_production_and_verification.md`](steps/17-qualified_map_production_and_verification.md) | Qualified Map Production And Verification | Map catalog, qualification matrix, browser verification, and map-design evidence. Technical/browser qualification passes; map-level human qualification remains `PENDING`. |
| 18 | `[x]` | — | `233340a` | [`steps/18-online_join_configuration.md`](steps/18-online_join_configuration.md) | Online Join Configuration | Browser online join uses the server-advertised public base URL and preserves deployment subpaths. |
| 19 | `[x]` | — | `5c45746` | [`steps/19-ki_vs_ki_battle.md`](steps/19-ki_vs_ki_battle.md) | KI-vs-KI Battle | Seeded autonomous KI-vs-KI menu play with reproducible fresh battle seeds. |
| 20 | `[x]` | — | `7738517` | [`steps/20-online_match_operations_sharing_and_player_support.md`](steps/20-online_match_operations_sharing_and_player_support.md) | Online Match Operations, Sharing, And Player Support | Authoritative map selection, pause/report/leave, reconnect-safe lifecycle, replay sharing, and operator dashboard operations. |
| 21 | `[x]` | — | `c305b93` | [`steps/21-database_backed_immutable_map_definitions.md`](steps/21-database_backed_immutable_map_definitions.md) | Database-Backed Immutable Map Definitions | Immutable UUID map revisions, canonical hashes, approval/retirement lifecycle, approved-map lookup/cache refresh, and persisted match map references. |
| 22 | `[x]` | — | `7a6f75e`, `501a401` | [`steps/22-recent_operations_improvements.md`](steps/22-recent_operations_improvements.md) | Recent Operations Improvements | Durable per-map game metrics and explicit online-leave abandonment with return to fresh matchmaking. |
| 23 | `[x]` | — | `57d0112` | [`steps/23-extend_sdk.md`](steps/23-extend_sdk.md) | Extend SDK | Generic Engine SDK, UI SDK, Audio SDK, and KORE SDK architecture with decoupled capability authoring and enum-backed vocabularies. |
| 24 | `[x]` | — | `c860f39` | [`steps/24-migration_player.md`](steps/24-migration_player.md) | Migration Player Creation And Configuration | Staged player creation migration with `kore.createPlayer()` and the `createRuntimePlayer()` factory boundary. |
| 25 | `[x]` | — | `19ed591` | [`steps/25-migration_effects.md`](steps/25-migration_effects.md) | Migration Effect Creation And Configuration | Staged effect creation migration with `kore.effects.*` and the `createRuntimeEffect()` factory boundary. |
| 26 | `[x]` | — | `5912d7c` | [`steps/26-extended_sdk.md`](steps/26-extended_sdk.md) | Extended SDK — Nested UI Containers And KORE Menu Integration | Nested-container UI SDK merged; KORE main menu migrated; focused tests, entry-point documentation, TypeScript, unit, browser-menu, and startup-smoke verification complete. |
| 27 | `[x]` | `milestone-27-sdk-migration-inventory` | `73787b2` | [`steps/27-sdk_migration_inventory_and_contract_freeze.md`](steps/27-sdk_migration_inventory_and_contract_freeze.md) | SDK Migration Inventory And Contract Freeze | Machine-checkable classification of every `src/**/*.ts` module plus direct legacy authoring audit and frozen layering contract. Evidence: `tests/sdk_migration_inventory.test.ts`, `SDK_MIGRATION_CONTRACT.md`, `npx tsc --noEmit`. |
| 28 | `[x]` | `milestone-28-handler-match-composition` | `b7c73a4` | [`steps/28-migration_game_handler_and_match_composition.md`](steps/28-migration_game_handler_and_match_composition.md) | Migration Game Handler And Match Composition | Canonical match creation and the offline pipeline now author through `kore.createMatchDefinition`/`createGameMode`/`createMatchSystemProfile` and construct handlers only through the `src/engine/runtimeFactory.ts` boundary; canonical settings, seeds, and adapters are unchanged. Evidence: `tests/match_sdk_migration.test.ts`, `node_modules/.bin/tsc --noEmit`, `bun run test:fast`. |
| 29 | `[x]` | `milestone-29-maps-structures-hazards` | `638226c` | [`steps/29-migration_maps_structures_and_hazards.md`](steps/29-migration_maps_structures_and_hazards.md) | Migration Maps, Structures, And Hazards | KORE SDK structure and force/kill-zone descriptors migrated across six catalog maps; canonical/runtime parity and map matrix verified in `tests/kore_sdk.test.ts`, `tests/map_content_inventory.test.ts`, and `tests/shipped_map_matrix.test.ts`. |
| 30 | `[x]` | `milestone-30-items-loadouts-effects` | `24cd781` | [`steps/30-migration_items_loadouts_and_effect_composition.md`](steps/30-migration_items_loadouts_and_effect_composition.md) | Migration Items, Loadouts, And Effect Composition | KORE SDK item/effect composition, official catalog migration, loadouts, pickups, seeded draws, mystery-box pools, and registry guardrails verified by `tests/kore_sdk.test.ts` and the item subsystem suites. |
| 31 | `[x]` | `milestone-31-ui-scenes-surfaces` | `464f606` | [`steps/31-migration_ui_scenes_and_gameplay_surfaces.md`](steps/31-migration_ui_scenes_and_gameplay_surfaces.md) | Migration UI Scenes And Gameplay Surfaces | SDK-authored replay viewer composition and browser adapter verified by `tests/kore_replay_viewer.test.ts`, replay tests, and UI SDK suites; operator HTML remains an explicit server adapter. |
| 32 | `[x]` | `milestone-32-input-commands-actions` | `5376ea2` | [`steps/32-migration_input_commands_and_actions.md`](steps/32-migration_input_commands_and_actions.md) | Migration Input, Commands, And Actions | KORE-owned input bindings and validated semantic pointer/action/item/menu commands now drive legacy bindings and touch routing; focused input suites and TypeScript verification pass. |
| 33 | `[x]` | `milestone-33-audio-feedback` | `859f95f` | [`steps/33-migration_audio_and_feedback_capabilities.md`](steps/33-migration_audio_and_feedback_capabilities.md) | Migration Audio And Feedback Capabilities | Generic Audio SDK state, KORE semantic cues/buses, deterministic music mixing, and browser output ownership verified by `tests/audio_sdk.test.ts`, `tests/kore_audio_pilots.test.ts`, and `tests/browser_audio_output.test.ts`. |
| 34 | `[x]` | `milestone-34-ai-simulation-entrypoints` | `7efe6c0` | [`steps/34-migration_ai_and_simulation_entry_points.md`](steps/34-migration_ai_and_simulation_entry_points.md) | Migration AI And Simulation Entry Points | KORE-owned validated AI profiles, producer/emitter creation, and versus/KI-vs-KI composition verified by `tests/kore_ai_sdk.test.ts` and the existing AI regression/fuzz suites. |
| 35 | `[x]` | `milestone-35-persistence-replay-network` | `e2897a3` | [`steps/35-migration_persistence_replay_and_network_boundaries.md`](steps/35-migration_persistence_replay_and_network_boundaries.md) | Migration Persistence, Replay, And Network Boundaries | Persisted authoritative matches and replay playback now restore through `kore.restoreHandler`; replay/share/network compatibility is verified by the persistence, replay, server, and network suites. |
| 36 | `[x]` | `milestone-36-application-bootstraps` | `fec3877` | [`steps/36-migration_application_bootstraps_and_platform_adapters.md`](steps/36-migration_application_bootstraps_and_platform_adapters.md) | Migration Application Bootstraps And Platform Adapters | Browser local/online bootstraps now use KORE runtime entry points; browser startup/menu E2E, focused contracts, build, and TypeScript verification pass. |
| 37 | `[x]` | `milestone-37-legacy-api-removal` | `95539da` | [`steps/37-legacy_api_removal_and_dependency_enforcement.md`](steps/37-legacy_api_removal_and_dependency_enforcement.md) | Legacy API Removal And Dependency Enforcement | Remove obsolete public constructors, duplicate factories, compatibility helpers, and legacy exports after all callers migrate. Add dependency/AST/import guards that prevent production code from reintroducing forbidden legacy paths. |
| 38 | `[x]` | `milestone-38-sdk-docs-mod-authoring` | `6d034a1` | [`steps/38-kore_sdk_documentation_examples_and_mod_authoring.md`](steps/38-kore_sdk_documentation_examples_and_mod_authoring.md) | KORE SDK Documentation, Examples, And Mod Authoring | Publish the supported authoring surface, layering rules (Engine SDK → KORE SDK → application), lifecycle examples, migration guide, mod examples, and explicit unsupported internals. Examples must compile and run in CI. |
| 39 | `[x]` | `milestone-39-cross-system-qualification` | `13082a5` | [`steps/39-sdk_migration_cross_system_qualification.md`](steps/39-sdk_migration_cross_system_qualification.md) | SDK Migration Cross-System Qualification | Prove legacy and SDK-created matches are behaviorally equivalent where compatibility is required: snapshots, replays, AI decisions, physics, items, maps, UI flows, online restoration, browser journeys, and deterministic fingerprints. |
| 40 | `[x]` | `milestone-40-sdk-only-release-gate` | `d892f19` | [`steps/40-sdk_only_release_gate.md`](steps/40-sdk_only_release_gate.md) | SDK-Only Release Gate | Final gate: production and supported examples use KORE SDK/Engine SDK authoring exclusively; forbidden legacy imports are zero; all focused, fast, full, browser, replay, persistence, networking, and release qualification suites pass; remaining adapters are documented runtime boundaries rather than authoring APIs. |
| 41 | `[-]` | `milestone-41-tactical-item-pack` | `4f95247` | [`steps/41-sdk_authored_tactical_item_pack.md`](steps/41-sdk_authored_tactical_item_pack.md) | SDK-Authored Tactical Item Pack | Public SDK item runtime boundary, atomic ordinary-item resolution, snapshot-safe item effects, and deterministic tests are implemented; dedicated browser item-control evidence remains pending. |
| 42 | `[x]` | `milestone-42-item-interaction-qualification` | `245cecb` | [`steps/42-item_interaction_and_combination_qualification.md`](steps/42-item_interaction_and_combination_qualification.md) | Item Interaction And Combination Qualification | Declarative stack/replace/reject policy, deterministic ordering, atomic conflicts, expiration cleanup, and snapshot/replay qualification are verified. |
| 43 | `[x]` | `milestone-43-animation-presentation-sdk` | `33224c8` | [`steps/43-deterministic_animation_and_presentation_sdk.md`](steps/43-deterministic_animation_and_presentation_sdk.md) | Deterministic Animation And Presentation SDK | Renderer-independent versioned presentation contracts, deterministic timelines, interruption/cancellation, restoration, vocabulary, example, and tests are complete. |
| 44 | `[x]` | `milestone-44-gameplay-feedback-pack` | `513f734` | [`steps/44-gameplay_feedback_and_animation_pack.md`](steps/44-gameplay_feedback_and_animation_pack.md) | Gameplay Feedback And Animation Pack | Authoritative semantic gameplay feedback, presentation/audio adapters, safe output handling, HUD integration, and replay-oriented focused tests are complete. |
| 45 | `[x]` | `milestone-45-competitive-map-pack` | — | [`steps/45-sdk_authored_competitive_map_pack.md`](steps/45-sdk_authored_competitive_map_pack.md) | SDK-Authored Competitive Map Pack | Added Aurora Basin, Lantern Gates, and Ember Crossing through public KORE map APIs with deterministic fingerprints, catalog/repository integration, focused AI/replay/restore qualification, and browser geometry probes; human fairness qualification remains pending. |
| 46 | `[x]` | `milestone-46-advanced-map-mechanics` | `bdc8178` | [`steps/46-advanced_map_mechanics_and_environmental_systems.md`](steps/46-advanced_map_mechanics_and_environmental_systems.md) | Advanced Map Mechanics And Environmental Systems | Versioned timed hazards, triggered zones, force fields, moving structures, environmental cycles, deterministic lifecycle state, restoration, and unsupported-mechanic rejection are implemented. |
| 47 | `[x]` | `milestone-47-sdk-authored-game-modes` | `6bdd3c7` | [`steps/47-sdk_authored_game_modes.md`](steps/47-sdk_authored_game_modes.md) | SDK-Authored Game Modes | Versioned Quick Slip and Power Rush modes are cataloged and wired through local, AI, replay, persistence, online initialization, and browser selection paths. |
| 48 | `[x]` | `milestone-48-versioned-mod-packages` | `d369e52` | [`steps/48-versioned_mod_package_format_and_loading.md`](steps/48-versioned_mod_package_format_and_loading.md) | Versioned Mod Package Format And Loading | Safe versioned content packages, canonical hashes, detached loading, dependency/reference validation, security rejection, example, and focused tests are complete. |
| 49 | `BLOCKED` | `milestone-49-content-cross-system-qualification` | `61b566c` | [`steps/49-new_content_cross_system_qualification.md`](steps/49-new_content_cross_system_qualification.md) | New Content Cross-System Qualification | Milestones 41–48 inventory, deterministic fingerprint/action-trace helpers, and explicit qualification matrix are complete; human fairness and unsupported platform evidence remain blocked/pending. |
| 50 | `BLOCKED` | `milestone-50-sdk-content-release-gate` | `ca595f4`, `d50ead9` | [`steps/50-sdk_authored_content_release_gate.md`](steps/50-sdk_authored_content_release_gate.md) | SDK-Authored Content Release Gate | Aggregate technical gate, browser/build/examples/desktop checks, and evidence record pass; human gameplay evidence remains blocked and platform-specific evidence remains pending. |

## Branch Convention

Each planned milestone has one canonical branch name in the table. Agents must
use that exact branch name and must not invent an alternative.

- create the branch from the current `staging` branch;
- if the named branch already exists, inspect and continue it rather than creating
  another branch;
- if the milestone is already complete on `staging`, do not create the branch;
- after a successful merge, keep the branch value in the row as historical
  execution metadata.

## SDK Migration Target Architecture

```text
Engine SDK
  ├─ generic deterministic engine contracts
  ├─ runtime-neutral settings and capability definitions
  ├─ generic UI and Audio SDK primitives
  └─ validated runtime factory boundaries

KORE SDK
  ├─ KORE/KORE vocabulary and presets
  ├─ players, effects, items, maps, matches, AI, UI, and audio authoring
  ├─ composition helpers built exclusively on Engine SDK contracts
  └─ stable public API for the application and mods

Application / Platform Adapters
  ├─ browser, server, desktop, PWA, tests, and tooling
  ├─ IO, persistence, transport, rendering, and platform integration
  └─ no direct legacy gameplay construction
```

## Migration Guardrails

1. **Settings remain canonical.** Runtime objects must continue to round-trip
   through deterministic, validated settings.
2. **SDK authoring does not bypass runtime validation.** The KORE SDK composes
   Engine SDK contracts; it does not create a second engine.
3. **Legacy migration is incremental.** Each milestone must preserve a green
   test baseline and remove or formally isolate the migrated legacy path.
4. **Do not weaken behavioral tests to complete migration.** Public interaction,
   persistence, replay, online, and deterministic contracts remain authoritative.
5. **Compatibility is explicit.** Snapshot/replay/map changes require either
   byte/structural compatibility or a versioned migration with rejection tests.
6. **Runtime factories are allowed boundaries.** Direct class construction may
   remain inside designated factories, deserializers, and adapters, but not in
   supported authoring code.
7. **No hidden dual architecture at completion.** Step 40 cannot pass while
   production composition can choose between legacy and SDK paths.

## Row Update Rule

When starting or completing a milestone, update only its row:

- use the exact branch name recorded in the `Branch` column;
- change `[ ]` to `[-]` when implementation begins;
- change `[ ]` or `[-]` to `[x]` when completion is verified;
- replace `—` with the verified short commit hash;
- keep the linked step file;
- replace the planned scope text with a concise delivery note and primary
  evidence files;
- append a new row only for genuinely new scope that is not already represented.

## Future Architecture Migration Plan

This plan records the next architectural direction. It is intentionally
incremental and does not authorize a large refactor or arbitrary executable
systems in normal content packages.

### Target Architecture

```text
Entity / State
= canonical typed JSON-safe data

Trigger / Rule
= determines WHEN something happens

Effect
= typed semantic request / modifier / command

Predefined ISystem
= trusted deterministic implementation that makes the Effect real

Framework Registry
= system graph, capabilities, supported effects, ordering, versions

Custom ISystem
= optional trusted host extension only, NOT normal mod content
```

Normal authoring should eventually compose:

```text
JSON-safe entity state
  -> trigger/rule
  -> typed effect
  -> capability validation
  -> predefined system
  -> deterministic state transition
```

Runtime implementation classes remain internal. Public contracts must not
expose `GameHandler`, `EntityManager`, `Player`, `PhysicsStrategy`, or similar
runtime internals. Normal JSON content remains data-only and must not contain
arbitrary executable code or unrestricted JSON patch effects.

### Phase 0: Baseline And Invariants

- [x] Establish baseline: inspect branch/worktree, preserve unrelated changes,
  run focused effect, item-effect, system-settings, snapshot, replay, Engine
  SDK, and KORE SDK tests, then run `npx tsc --noEmit` and record results.
- [x] Document current Player, Handler/world, structure-collision, item, and
  hazard effect flows, including serialized settings, factories, interpreters,
  triggers, mutation targets, and snapshot paths.

No production refactor is part of this phase.

#### Phase 0 Evidence

Baseline was run on branch `engine_expansion` with the pre-existing unrelated
worktree change in `src/main.ts` preserved:

| Area | Command | Result |
|---|---|---|
| Effects | `bun test tests/effect_test.ts tests/effect_factory_roundtrip.test.ts tests/setting_effect.test.ts` | 22 passed, 0 failed |
| Item effects | `bun test tests/item_effect_snapshot_validation.test.ts tests/item_effect_interactions.test.ts tests/item_inventory.test.ts` | 11 passed, 0 failed |
| System settings/registry | `bun test tests/system_settings_roundtrip.test.ts tests/engine_system_registry.test.ts tests/system_id_stability.test.ts` | 7 passed, 0 failed |
| Snapshots | `bun test tests/handler_snapshot_isolation.test.ts tests/simulate_turn_isolation.test.ts tests/parallel_engine_instances.test.ts` | 7 passed, 0 failed |
| Replay | `bun test tests/ai_replay_lifecycle.test.ts tests/replay_rule_state_orchestration.test.ts tests/replay_validation.test.ts` | 8 passed, 0 failed |
| Engine/KORE SDK | `bun test tests/engine_sdk_architecture.test.ts tests/sdk_standalone_bundles.test.ts tests/kore_sdk.test.ts` | 15 passed, 0 failed |
| TypeScript | `npx tsc --noEmit` | Passed |

The current effect flows are:

- **Player effects:** `PlayerSettings.effects` are reconstructed by
  `Player.applySettings()` through `createRuntimeEffect()`; Always Movement
  and Physics effects are interpreted directly by `Player.tick()`, Collision
  effects by `Player.onCollision()`, and all three trigger lists are serialized
  back into `PlayerSettings.effects`.
- **Handler/world effects:** `GameSettings.effects` are loaded by
  `GameHandler.loadEffects()` into runtime effect lists. Always effects are
  applied to every entity from `GameHandler.tick()`; Round and Collision lists
  are retained and serialized by `GameHandler.toSettings()`, but their runtime
  execution is not a complete centralized EffectSystem pipeline.
- **Structure collision effects:** map boundary effects are reconstructed by
  `StructureCircle`, `StructureRectangle`, or `StructureLine`. Collision
  callbacks from `defaultPhysics` invoke the concrete structure's
  `onCollision()`, which applies its `MetaEffect` list to the colliding entity.
  Structure settings serialize the effect lists again.
- **Item effects:** validated `ItemDocument.effects` enter through
  `ItemValidator` and `createRuntimeItemEffect()`. Immediate effects are
  resolved by `GameHandler.useItem()`; persistent effects are stored as
  `PlayerSettings.itemEffects`, advanced at turn boundaries, and restored by
  the item runtime boundary. This is currently the strongest data-defined
  effect flow.
- **Hazard effects:** supported map/editor hazards are converted into typed
  collision `FullEffectSettings` by `src/contracts/documents.ts`, commonly
  `ModifySetting` mutations for death or velocity. They then follow the
  structure collision path rather than a separate hazard interpreter.

The common serialized boundary remains `{ type, typeValue, trigger,
triggerValue }`; `typeValue` and `triggerValue` are still broad in the current
contract. `MetaEffect` rejects unknown core effect types, while
`validateGameSettings()` currently validates known type/trigger identities more
strongly than their payload shapes. This is the primary constraint for Phase 1.

### Phase 1: Strongly Typed Effect Contracts

- [x] Inventory every Effect type, payload, target, trigger, lifecycle,
  interpreter, serialization path, and validation path.
- [x] Introduce a typed mapping between Effect identity and payload without
  unnecessarily changing the existing serialized shape.
- [x] Add per-Effect payload validators for required fields, finite numbers,
  supported values, executable values, and unexpected structures.
- [x] Type Trigger payloads independently from Effect payloads.

Do not migrate every Effect simultaneously. Each change requires focused tests
and an atomic commit.

#### Phase 1.1 Effect Inventory

Core `EffectType` settings use `{ type, typeValue }` and become
`FullEffectSettings` when attached to an `Always`, `Collision`, or `Round`
trigger. Core effects target physics-capable entities or structures, except
`ModifySetting`, which targets the allowlisted mutable Player settings.

| Effect | Payload | Category | Current interpreter | Persistence |
|---|---|---|---|---|
| `Physics` | friction, linear drag, stop threshold | Modifier | `Player.tick()` | Player effects and snapshots |
| `Damage` | damage amount | Command | `EffectDamage` → Player HP/death | Player/handler/structure settings |
| `Movement` | delta time and x/y displacement | Modifier | `Player.tick()` | Player effects and snapshots |
| `Multi` | ordered core Effect settings | Command/composition | `MultiEffect` | Nested settings |
| `ModifyMass` | mass | Modifier | runtime Effect → physics object | Attached settings |
| `ModifySize` | size | Modifier | runtime Effect → resizable entity | Attached settings |
| `Position` | x/y position | Command | runtime Effect → physics object | Attached settings |
| `Velocity` | x/y velocity | Command | runtime Effect → physics object | Attached settings |
| `Team` | team number array | Command | runtime Effect → team-capable entity | Attached settings |
| `ModifySetting` | set/add/remove, allowlisted key, typed value | Command | `Player.setSetting()` | Handler/player/structure settings |
| `RespawningPosition` | removed unused identifier | Legacy contract removed in Phase 1 | No runtime interpreter | No serialized support |

Item effects use `{ type, typeValue }` with optional `itemId` and `order` source
metadata. They are validated as item content, constructed by
`src/kore/sdk/itemRuntime.ts`, and persistent instances are stored in
`PlayerSettings.itemEffects`.

| Item effect | Payload/state | Category | Current interpreter | Persistence |
|---|---|---|---|---|
| `modifyForce` | factor | Modifier | item runtime / force application | Item effect state |
| `modifyRotation` | degrees | Modifier | item runtime / force application | Item effect state |
| `lockRotation` | duration and remaining turns | Status | Player/item turn advancement | Item effect state |
| `applyTorque` | torque | Modifier | item runtime angular application | Item effect state |
| `spawnTrigger` | trigger ID, delay, fired state | Scheduled action | item runtime / turn advancement | Item effect state |
| `delayedEffect` | nested effect ID/payload, delay, fired state | Scheduled action | item runtime / fixed ticks | Item effect state |
| `shield` | capacity, remaining capacity, collision blocking | Status | item runtime / collision and damage adapters | Item effect state |
| `freeze` | speed factor, duration, remaining turns | Status | item runtime / velocity adapter | Item effect state |
| `swapPosition` | empty payload; validated targets are runtime input | Command | `GameHandler.useItem()` | Action/replay, not persistent state |
| `temporaryWall` | wall geometry, lifetime, active state | Status/command | item runtime / structure lifecycle | Item effect state |
| `ghostMode` | duration and remaining turns | Status | item runtime / collision filtering | Item effect state |
| `magnet` | attract/repel mode, force, range | Modifier/command | `GameHandler.useItem()` | Item action/effect state |
| `selectionLock` | duration and remaining turns | Status | UI/item target validation | Item effect state |
| `aimVariance` | variance and seeded random state | Modifier | item runtime / force application | Item effect state |

The inventory confirms that core effect payloads can be strongly typed without
merging them with item lifecycle payloads. It also records the existing gap:
`settings.ts` validates core Effect identities and triggers, but does not yet
validate each payload shape at the document boundary.

#### Phase 1 Completion Evidence

Phase 1 preserves the existing `{ type, typeValue, trigger, triggerValue }`
wire shape while replacing the core `typeValue: any` contract with a
discriminated `EffectPayloadMap`. Item runtime payloads have a separate typed
mapping for validation while the existing item authoring input remains
transitional. `validateEffectSettings()` is trigger-independent;
`validateTriggerSettings()` is Effect-independent; `validateFullEffectSettings()`
is the only composition validator. The unused `RespawningPosition` identifier
and empty movement-payload compatibility path were removed because no legacy
serialized games require them.

### Phase 2.2 Ownership Rule

Canonical entity/component state owns the current value observed by gameplay and
snapshots, including position, velocity, health, team, and lifecycle flags.
Effects own the request, modifier, status, reaction, or scheduled instruction
that can produce a transition. An applied `ModifySetting` therefore does not
become the current health value, and a persistent Movement Effect does not
replace the entity's current position. Both the resulting state and the
persistent Effect definition are serialized independently when applicable.

### Phase 2: Effect Lifecycle Semantics

- [x] Add explicit metadata for `modifier`, `command`, `reaction`, `status`,
  and `scheduled` semantics without forcing a new hierarchy on all existing
  runtime classes.
- [x] Document and test ownership: entity/component state owns current state;
  Effects own requests, modifiers, statuses, or reactions.
- [x] Formalize existing deterministic ordering for conflicting, nested, and
  multi-Effects, preserving current behavior unless a versioned contract
  change is required.

### Phase 2.3 Ordering Rules

Installed item Effects use ascending explicit `order`, defaulting to zero;
equal orders retain insertion/declaration order. Multi Effect children retain
their serialized declaration order. Core triggered Effects retain their
existing per-trigger insertion lists and canonical serialization grouping;
this phase does not introduce a new cross-trigger execution order. These rules
are implemented by `src/effects/ordering.ts` and covered by
`tests/effect_ordering.test.ts`.

#### Phase 2 Completion Evidence

`src/effects/lifecycle.ts` provides static metadata for every supported core
and item runtime Effect. The metadata is not serialized and does not alter
runtime class hierarchies. Canonical state ownership is covered by
`tests/effect_state_ownership.test.ts`; deterministic item ordering, Multi
Effect declaration order, and existing trigger-list grouping are covered by
`tests/effect_ordering.test.ts` and the existing snapshot/item suites.

### Phase 3: Capability-Aware Effect Metadata

- [x] Add a separate Effect capability requirement concept; do not overload
  system-to-system `requires` semantics.
- [x] Register stable Effect IDs, schema versions, payload validators, target
  types, required capabilities, and lifecycle categories in a data/contract
  catalog. The catalog must not serialize executable factories.
- [x] Validate that every Effect capability is provided by the active framework
  before gameplay starts, including missing providers, duplicate providers,
  replacement systems, and deterministic validation errors.

#### Phase 3 Completion Evidence

`EngineEffectRegistry` stores stable Effect descriptors and host-side payload
validators separately from serialized framework settings. `acceptsEffects` is
system metadata, while `requiresCapability` remains Effect metadata; neither
is overloaded into the existing system dependency fields. Framework validation
now rejects unknown Effects, unsupported payloads, unaccepted Effect IDs, and
missing capability providers before execution. Runtime validator functions are
never included in descriptors or snapshots. The standalone Engine SDK bundle
and declarations publish the catalog and framework validation APIs.

### Phase 4: Typed Canonical Entity State

- [x] Separate generic Engine concepts from KORE-specific state currently held
  by Player/Entity settings.
- [x] Introduce the first small, versioned, validated, detached JSON-safe
  component boundary, starting with Transform/Position and Movement/Velocity
  where repository evidence supports it.
- [x] Add internal adapters between typed canonical state and existing runtime
  Player objects; prove settings-to-runtime-to-settings equivalence.
- [x] Preserve current KORE SDK Player/Game settings while the transitional
  generic Engine and KORE boundaries coexist.

#### Phase 4.4 Compatibility Evidence

`tests/kore_state_compatibility.test.ts` verifies that `kore.createPlayer()`
continues to return complete `PlayerSettings` and that generic Transform/
Movement state additions do not add component fields to canonical KORE
`GameSettings`. The generic state boundary and KORE document boundary coexist
without converting Player into a public ECS runtime object.

#### Phase 4 Completion Evidence

The generic Engine SDK now exposes detached version-one Transform and Movement
state plus validators/builders. `src/entity/stateAdapter.ts` is internal and
maps only those fields to runtime Player objects. KORE `PlayerSettings` and
`GameSettings` remain unchanged and continue through their existing validators.

Do not convert the whole engine to pure ECS or expose runtime Player objects.

#### Phase 4.1 State Inventory

Generic Engine state candidates already present in runtime snapshots are:

| Generic concept | Current canonical fields | KORE-specific fields kept outside the generic boundary |
|---|---|---|
| Transform | `position`, `rotation` | player icon, hoop, color, rendering assets |
| Movement | `velocity`, `angularVelocity`, `isPhysicsEnabled` | ice drift/friction interpretation and turn rules |
| Collision shape | `size`, `shape`, `bouncyness`, `mass` | current KORE circle-only Player implementation |
| Health/lifecycle | `hp`, `isDead` | last-team-standing match semantics |
| Ownership | `team` | KORE team roster/naming and player-count metadata |
| Inventory/status | `inventory`, `itemEffects`, `effects` | KORE item catalog and target rules |

Phase 4 exposes only the first two generic state groups. Complete Player and
GameSettings documents remain the KORE compatibility boundary; no generic
component store or arbitrary JSON component mutation is introduced here.

### Phase 5: Pilot One Effect Family Behind A System

Movement is the preferred pilot because it is deterministic, runs every tick,
has a clear current interpreter, and has clear inputs/outputs. Physics and
collision should not be migrated in the same change.

- [x] Add characterization tests for current movement behavior, stacked Effects,
   ordering, snapshots, replay where relevant, no-Effect behavior, and edge
   values. This is a test-only atomic commit.
- [x] Declare the appropriate movement capabilities and connect Movement
   Effects to the capability contract without changing runtime interpretation.
- [x] Introduce or adapt a trusted internal MovementSystem that interprets the
   typed movement state/Effects and applies controlled deterministic mutations.
- [x] Remove the old duplicate movement interpreter from Player only after the
   new path is fully tested and there is one authoritative interpreter.
- [x] Run movement, Effect, snapshot, replay, local-match, relevant browser,
   and TypeScript regression checks before continuing.

#### Phase 5 Completion Evidence

`core.movement` is a trusted serializable system with a pre-entity tick hook so
Movement Effects retain their historical ordering before Player friction. The
generic Engine SDK publishes the `movement.integrate` Effect contract and its
`movement.state` capability; runtime interpretation remains internal. Movement
characterization, capability, snapshot/replay, local-match, fast-suite, browser
smoke, build, SDK bundle, and TypeScript verification pass. Collision and
friction remain outside the migrated MovementSystem.

### Phase 6: Trigger Architecture

- [x] Inventory current Always, Round, Collision, delayed, environmental,
   item-runtime, rule, Player, Structure, Physics, and Handler trigger behavior.
- [x] Define only the typed, versioned Trigger contracts supported cleanly by
   current runtime behavior; do not add speculative trigger categories.
- [x] Separate Trigger activation from the Effect it activates while retaining
   compatibility adapters where necessary.
- [x] Define deterministic ordering for simultaneous triggers, same-tick versus
   next-tick Effects, nested triggers, snapshots, and recursion limits.
- [x] Reject or bound recursive Trigger/Effect chains deterministically.

#### Phase 6.1 Trigger Inventory

| Trigger source | Current activation boundary | Ordering / timing | Snapshot state | Current limitation |
|---|---|---|---|---|
| Handler `Always` | `GameHandler.tick()` applies handler-level Always Effects before system pre-ticks and entity ticks. | Handler declaration order, once per tick. | Effect definitions serialize in handler settings. | No independent trigger event or recursion budget. |
| Player `Always` | `MovementSystem.preTick()` handles Movement; `Player.tick()` handles Physics. | Movement pre-entity, then entity-local Physics, preserving legacy order. | Player Effect lists serialize by trigger. | Other Always Effect types remain outside a centralized trigger dispatcher. |
| Player `Collision` | `Player.onCollision()` applies the Player collision list when PhysicsSystem reports a collision entry. | Physics solver contact lifecycle controls entry callbacks; list declaration order is retained. | Player Effect list serializes; contact lifecycle serializes in PhysicsSystem. | Trigger payload is currently always `[]`; activation is coupled to runtime collision callbacks. |
| Structure `Collision` | Circle/rectangle `onCollision()` applies collision Effects; lines have no collision interpreter. | Physics solver contact-entry lifecycle and structure iteration order. | Structure Effects serialize with geometry. | Handler-level collision Effects are stored but not dispatched. |
| `Round` | Player, Structure, and Handler Round lists are loaded and serialized but have no complete runtime dispatcher. | No authoritative execution order exists. | Definitions serialize; no activation cursor exists. | This is the primary Phase 6 migration gap. |
| Item scheduled effects | `spawnTrigger` and `delayedEffect` are advanced through item runtime state at turn/tick boundaries where the owning item path invokes them. | Installed item `order`, then declaration order for ties; remaining counters are state. | Remaining turns/ticks and fired state serialize in `itemEffects`. | These are item-runtime schedules, not shared core Trigger contracts. |
| Map pickups | `MapPickupSystem.ticker()` checks active-team occupancy after gameplay systems. | Pickup index order; collection and occupant state update in one tick. | `itemPickupState` serializes. | Pickup entry is a domain-specific trigger, not a core Effect trigger. |
| Environmental zones | `EnvironmentalSystem.ticker()` increments deterministic tick state and evaluates triggered zones before structure enablement. | Mechanic declaration order; activation/cooldown counters are explicit. | Lifecycle arrays serialize through system settings. | Zone activation currently changes structures, not a general Effect queue. |
| Rule/item phases | `RuleInterpreter` and `GameHandler` advance phase/turn state; item uses reset and persistent item Effects advance when turn changes. | Data-defined phase order and active-team progression. | `ruleState`, turn, and item counters serialize. | Rule transitions are not represented as generic Trigger activations. |
| Physics contacts | `PhysicsSystem` resolves collision/depenetration and tracks active contact keys. | Bounded solver iterations and entry-only collision callbacks. | Active contact pairs serialize at completed tick boundaries. | Collision callbacks can directly mutate entities; no queued same-tick/next-tick Effect model exists. |

The inventory establishes that only Always and collision-entry paths have a
complete core runtime interpretation today. Phase 6 must separate activation
from Effect execution without changing those deterministic boundaries, define
explicit Round and scheduled-event semantics only where current behavior can
support them, and reject recursive chains rather than introducing unrestricted
callbacks.

#### Phase 6.2 Trigger Contract Evidence

`src/engine/sdk/trigger.ts` defines detached schema-version-one `tick` and
`collision.enter`, `round.start`, and `environment.activation` events with exact
payload validation, finite timing, safe sequence numbers, and no executable
fields. Item-runtime, pickup, and rule-specific schedules remain domain-specific
until their application targets are explicit.

The same module separates trigger events from Effect identity through a
versioned activation envelope and provides a trusted-host FIFO activation queue.
The queue clones records, preserves insertion order, and rejects recursive
chains after a bounded activation budget. Existing KORE trigger fields remain
compatible. `src/effects/triggerDispatcher.ts` now bridges handler Always,
Player Always/Collision, MovementSystem tick, and circle/rectangle structure
collision callbacks through that queue without changing serialized settings or
legacy declaration order.

Round activation now uses the same bridge at `GameHandler.startTurn()`, with a
typed `round.start` event carrying turn, team, and phase context. Handler and
Player Round Effects execute once per started turn; snapshot restoration does
not re-run the activation.

`EnvironmentalSystem` emits `environment.activation` through the same bounded
queue when a mechanic changes active state. Structure enablement remains the
authoritative mutation and environmental lifecycle snapshots are unchanged.
`delayedEffect` now has explicit target and due-activation semantics. `spawnTrigger`
uses the separate named TriggerDefinition catalog for entity and stable structure
targets. Position-targeted structure triggers persist the selected position
separately from the canonical structure ID; Falltür activation and timeout remain
data-only trigger definitions.

## Scheduled Item Semantics

`delayedEffect` supports a validated normal `nestedEffect` core Effect/MultiEffect
branch and preserves the existing item-runtime nested-effect branch for current
official content. It captures a version-one resolved entity or position target at item use. Its
remaining tick count is advanced only by `GameHandler.tick()`; a transition from
`remainingTicks: 1` to zero emits one transient `schedule.due` activation in the
same authoritative tick. Entity targets resolve by stable ID and missing/dead
targets no-op; position targets use the persisted coordinates. Zones are
rejected because no stable zone contract exists. Completed schedules are
removed, and snapshot restoration resumes only remaining schedules.

Current supported delayed target compatibility is explicit: entity targets may
install supported persistent item effects or apply Magnet immediately; position
targets currently support Magnet only. Structural, swap, and nested scheduled
item Effects are rejected rather than interpreted generically.

`spawnTrigger` persists its entity or stable structure target and turn countdown.
At the next turn boundary it resolves `triggerId` through
`GameSettings.triggerDefinitions`, emits one transient `schedule.due` activation,
and executes the validated core Effect or MultiEffect against the persisted target.
Structure triggers may also carry the position captured at item use. Unknown
definitions, unknown structure IDs, and recursive scheduled definitions reject
before mutation. Falltür uses one dormant canonical structure slot: activation
enables both physics and drawing through an ordered MultiEffect, while a second
scheduled trigger disables both flags without allocating or removing a runtime
structure.

### Phase 7: Declarative Commands

Add command families only for real authoring use cases. Every family requires a
typed payload, schema version, target schema, capability, deterministic
semantics, ordering semantics, serialization behavior, and tests.

- [x] Transform commands: generic absolute set-position and set-rotation contracts are registered through the Engine SDK; teleport remains the set-position semantic rather than a separate speculative primitive. Runtime interpretation remains deferred until a generic runtime host exists.
- [x] Movement commands: generic set-velocity, add-velocity, and non-negative speed-scaling contracts are registered through the Engine SDK; impulse remains deferred because it requires an explicit mass/impulse semantic. Runtime interpretation remains deferred until a generic runtime host exists.
- [ ] Lifecycle commands such as spawn, destroy, enable, disable, and reset,
  only after lifecycle state has a stable canonical contract.
- [x] Generic counter state and commands are Engine concepts; numeric counter
  state is world-owned, versioned, snapshot/replay-safe, and interpreted by
  the predefined `core.counter` system. KORE score remains a game-layer
  meaning and is not introduced because the current game has no numeric score
  consumer.

Lifecycle commands remain intentionally deferred. The generic Engine SDK does
not yet define canonical active/destroyed state, entity or structure allocation
and identity semantics, or lifecycle snapshot/replay behavior. Capability-local
fields such as movement `enabled` and KORE structure `physicsEnabled`/
`drawingEnabled` are not substitutes for that contract. Do not add spawn,
destroy, enable, disable, or reset command payloads until those invariants are
specified and qualified.

Generic counter state is now canonical Engine state. `CounterState[]` is owned
by the world snapshot, `counter.set`, `counter.add`, and `counter.reset` are
typed current-schema commands, and `core.counter` is an interpreter with no
parallel value store. Stable counter IDs are the target identity; team/entity
meanings remain content-layer conventions. Counter commands compose in
declaration order, use the existing trigger vocabulary and activation budget,
and replay from canonical initial state. KORE's current last-team-standing
winner remains independent because it has no numeric score state to migrate.

Avoid microscopic field-level Effects and unrestricted generic setting patches.

### Phase 8: Predefined Generic Systems

When a real authoring requirement cannot be expressed with existing systems,
add one engine-owned capability instead of exposing arbitrary custom ticks.

Candidate systems are Movement, Input, Collision, Score, Spawn,
RoundLifecycle, and Trigger systems. Each new system must define its capability,
versioned state, accepted typed Effects, Trigger integration, deterministic
runtime implementation, snapshot round trip, replay/network regression, and
only the authoring-safe SDK exports. Each capability is an atomic change or
small coherent sequence of commits.

Phase 8 is **partially qualified** through `CounterSystem`, but the generic
predefined-System runtime path is not yet complete. Counter proves a real
engine-neutral interpreter: typed current-schema commands are capability
registered, validated, applied deterministically to world-owned canonical
state, restored through the system snapshot factory, and replayed from a
canonical origin. Its evidence is `tests/engine_counter_state.test.ts`,
`tests/engine_counter_capability.test.ts`,
`tests/counter_system_composition.test.ts`, `tests/counter_runtime.test.ts`,
and `tests/counter_replay.test.ts`.

The remaining missing Phase 8 criterion is a generic predefined-System host and
dispatcher. `EngineSystemRegistry` still selects and validates metadata only;
it does not instantiate runtime systems or dispatch Engine Effects by
capability. `GameHandler.applyCounterEffect()` locates `CounterSystem` through
an explicit runtime adapter, and `ReplayPlayer` has an explicit counter-action
branch. Those paths are deterministic and not score-specific, but they are not
yet the generic Handler/runtime orchestration path required by Phase 8. Do not
add more generic Systems until that host boundary has a concrete consumer and
contract. Arbitrary custom executable Systems remain a separate future trusted
extension concern.

### Phase 9: Pong External Qualification

Use Pong as an external expressiveness test, not as a source of Pong-specific
engine hacks. From standalone SDK bundles, author a field, ball, paddles,
movement, input bindings, collision, goals, score, reset, win condition, HUD,
pause/rematch, and audio without inspecting engine internals or implementing
arbitrary `tick()` code.

For every unsupported concept, decide whether it is a reusable Engine capability
or Pong-specific. Add only the smallest reusable capability, with tests and an
atomic commit, then rerun the external qualification.

Phase 9 remains deferred because the repository has no standalone Pong authoring
target or external qualification harness. The current KORE game is not a valid
Pong substitute, and inventing a Pong-specific example would not establish the
intended external expressiveness evidence.

### Phase 10: Serialization Hardening

- [x] Version public Effect schemas, Trigger schemas, and component/state
  schemas with explicit migration or rejection behavior. Current runtime Effect
  settings require schema version one; historical unversioned Effects are
  normalized only at the handler restore boundary. Canonical entity state uses
  orthogonal participation flags, and canonical structures require stable IDs
  plus explicit physics/drawing participation flags. Historical structure IDs
  are assigned only by the structure migration boundary.
- [x] Preserve canonical content fingerprints where required for replay,
  multiplayer, and compatibility checks.
- [x] Distinguish persistent snapshot state, replay actions/events, and
  ephemeral runtime events so transient execution artifacts are not serialized.

Evidence: `tests/content_package.test.ts`,
`tests/sdk_content_release_gate.test.ts`,
`tests/engine_trigger_contract.test.ts`,
`tests/item_effect_snapshot_validation.test.ts`, and
`tests/handler_snapshot_isolation.test.ts`,
`tests/effect_migration.test.ts`, and
`tests/structure_identity_migration.test.ts`.

### Phase 11: Replay And Multiplayer Qualification

Qualify the invariant:

```text
same engine version + same content + same initial state + same actions
= same deterministic result
```

- [x] Verify all migrated state, Effects, and Triggers round-trip.
- [x] Verify replay reproduces migrated behavior exactly.
- [x] Keep executable behavior server-owned; clients provide validated data and
  actions only.
- [x] Reject unsupported Effect/system capabilities before match start.
- [x] Define explicit unsupported schema and capability version errors.

Evidence: `tests/cross_system_validation_smoke.test.ts`,
`tests/deterministic_replay.test.ts`, `tests/replay_format.test.ts`,
`tests/engine_effect_capability_validation.test.ts`,
`tests/engine_trigger_contract.test.ts`, and the server/network validation
suites.

Counter evidence: `tests/engine_counter_state.test.ts`,
`tests/engine_counter_capability.test.ts`,
`tests/counter_system_composition.test.ts`,
`tests/counter_runtime.test.ts`, and `tests/counter_replay.test.ts`.

### Phase 12: Public SDK Cleanup

Only after real consumers exist:

- [x] Export stable typed Effect authoring contracts/builders.
- [x] Export Trigger authoring contracts without runtime callbacks.
- [x] Export typed canonical state contracts without runtime entities.
- [x] Export framework capability metadata while keeping implementation classes
  internal.
- [x] Build standalone bundles/declarations and verify they contain no internal
  repository imports.
- [x] Run an external smoke test using only the standalone SDK bundles.

Evidence: `tests/sdk_only_release_gate.test.ts`,
`tests/sdk_standalone_bundles.test.ts`, `tests/sdk_examples_ci.test.ts`, and
`bun run sdk:release-gate`.

### Phase 13: Trusted Custom System Tier

This phase is explicitly later and is not required for the initial migration.

Eventually evaluate a second tier for explicitly installed trusted host
extensions:

```text
trusted host extension
  -> custom ISystem
  -> custom Effect interpreter
  -> custom runtime factory
```

Rules:

- never automatically load code from mod JSON;
- require explicit host installation and extension identity/version;
- store only IDs and JSON-safe state in snapshots, never implementation code;
- let multiplayer hosts decide which extensions are permitted;
- keep normal KORE/Engine content data-only.

### Atomic Commit Policy

Each completed checklist item ends with focused tests, relevant regression
tests, TypeScript validation, serialization inspection when affected, and one
atomic commit. Suitable commit scopes include:

```text
test(effects): characterize movement effect behavior
refactor(effects): add typed movement payload contract
refactor(effects): validate movement effect payload
feat(engine): register movement capability
refactor(engine): interpret movement effects in MovementSystem
refactor(entity): remove legacy movement effect interpreter
feat(triggers): add typed collision trigger contract
feat(engine): validate effect capability requirements
```

Do not combine unrelated cleanup, speculative refactors, or broad architecture
rewrites. After each step, report the exact changed files, architectural and
behavioral effect, tests and results, serialization impact, replay/network
impact, commit hash, and remaining risk. If a step reveals a constraint, stop
after the current safe atomic change and document the adjustment before
continuing.

### Migration Definition Of Success

Normal external authoring increasingly expresses behavior as:

```text
Entity State + Trigger + Effect + Rule + predefined capabilities
```

without access to `GameHandler`, runtime Player classes, `EntityManager`,
`PhysicsStrategy`, or arbitrary custom `tick()`. The resulting architecture
must retain deterministic snapshots, replay, authoritative multiplayer,
JSON-safe mods, public SDK validation, and standalone SDK distribution.

## Post-Milestone Cleanup

### Remove Unused Structure Spawn Contract

Commit `7320e82` removed the unused transitional `structure.spawn` contract and
its standalone test:

- `src/structures/spawnCommand.ts`
- `tests/structure_spawn_command.test.ts`

No production, content, Engine SDK, KORE SDK, or documentation references to
the removed contract remain. The qualified dormant Falltür composition is
unchanged: it uses a canonical dormant structure, stable structure identity,
resolved targets and positions, `TriggerDefinition`, ordered `MultiEffect`
enablement, collision Effects, and scheduled deactivation. Runtime structure
spawning remains a deferred future capability and has no current canonical
contract.

Verification: focused architecture tests passed (`38 pass`, `0 fail`),
`npx tsc --noEmit` passed, SDK generation passed, and the fast suite passed
(`861 pass`, `3 skip`, `0 fail`). The worktree was clean after the commit.

## Current Roadmap Stop

The remaining unchecked Phase 7 items are evidence-based deferrals, not
unfinished runtime work:

- Lifecycle commands remain deferred because Engine has no canonical allocation,
  identity, active/destroyed, or snapshot/replay lifecycle contract.
- Generic score/counter commands remain deferred because no engine-neutral
  consumer or canonical ownership exists; scoring belongs to KORE rules.

There is currently no safe next implementation item. Reopen either item only
when a concrete consumer supplies the missing canonical contract; otherwise the
next work would be speculative architecture.
