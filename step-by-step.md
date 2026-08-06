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
| 15 | `[x]` | — | `a9ad011` | [`steps/15-gameplay_qualification_and_human_playtest_validation.md`](steps/15-gameplay_qualification_and_human_playtest_validation.md) | Gameplay Qualification And Human Playtest Validation | Automated matrix, fairness, pacing, agency, item, replay, and package evidence complete. Human playtest evidence remains `BLOCKED / PENDING`; no external tester session exists. Guardrail: subjective preference is not a technical invariant. |
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
| 34 | `[ ]` | `milestone-34-ai-simulation-entrypoints` | — | [`steps/34-migration_ai_and_simulation_entry_points.md`](steps/34-migration_ai_and_simulation_entry_points.md) | Migration AI And Simulation Entry Points | Migrate AI creation, difficulty profiles, seeded decision limits, headless simulation, KI-vs-KI, and turn production to stable KORE SDK entry points without bypassing Engine SDK validation or snapshot lifecycles. |
| 35 | `[ ]` | `milestone-35-persistence-replay-network` | — | [`steps/35-migration_persistence_replay_and_network_boundaries.md`](steps/35-migration_persistence_replay_and_network_boundaries.md) | Migration Persistence, Replay, And Network Boundaries | Ensure save/load, replay, online initialization, authoritative server restoration, SDK exports, and network payload construction consume canonical SDK settings/contracts rather than legacy runtime constructors or duplicated composition logic. Existing snapshots and replay documents must remain compatible or receive an explicit versioned migration. |
| 36 | `[ ]` | `milestone-36-application-bootstraps` | — | [`steps/36-migration_application_bootstraps_and_platform_adapters.md`](steps/36-migration_application_bootstraps_and_platform_adapters.md) | Migration Application Bootstraps And Platform Adapters | Replace legacy composition in browser, server, desktop, PWA, test harness, SDK demo, and tooling entry points. Platform adapters may provide IO, but game composition must flow through KORE SDK APIs. |
| 37 | `[ ]` | `milestone-37-legacy-api-removal` | — | [`steps/37-legacy_api_removal_and_dependency_enforcement.md`](steps/37-legacy_api_removal_and_dependency_enforcement.md) | Legacy API Removal And Dependency Enforcement | Remove obsolete public constructors, duplicate factories, compatibility helpers, and legacy exports after all callers migrate. Add dependency/AST/import guards that prevent production code from reintroducing forbidden legacy paths. |
| 38 | `[ ]` | `milestone-38-sdk-docs-mod-authoring` | — | [`steps/38-kore_sdk_documentation_examples_and_mod_authoring.md`](steps/38-kore_sdk_documentation_examples_and_mod_authoring.md) | KORE SDK Documentation, Examples, And Mod Authoring | Publish the supported authoring surface, layering rules (Engine SDK → KORE SDK → application), lifecycle examples, migration guide, mod examples, and explicit unsupported internals. Examples must compile and run in CI. |
| 39 | `[ ]` | `milestone-39-cross-system-qualification` | — | [`steps/39-sdk_migration_cross_system_qualification.md`](steps/39-sdk_migration_cross_system_qualification.md) | SDK Migration Cross-System Qualification | Prove legacy and SDK-created matches are behaviorally equivalent where compatibility is required: snapshots, replays, AI decisions, physics, items, maps, UI flows, online restoration, browser journeys, and deterministic fingerprints. |
| 40 | `[ ]` | `milestone-40-sdk-only-release-gate` | — | [`steps/40-sdk_only_release_gate.md`](steps/40-sdk_only_release_gate.md) | SDK-Only Release Gate | Final gate: production and supported examples use KORE SDK/Engine SDK authoring exclusively; forbidden legacy imports are zero; all focused, fast, full, browser, replay, persistence, networking, and release qualification suites pass; remaining adapters are documented runtime boundaries rather than authoring APIs. |

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
