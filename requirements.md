# Slipstrike Requirements Ledger

## Purpose

This ledger connects the reconciled implementation inventory in `TODO.md` and
the product intent in `gdd.md` to the commit-sized work in `step-by-step.md`.
It prevents a feature from being considered complete solely because a prototype,
commented test, or editor-only data exists.

`Current evidence` names active tests or verified runtime behavior. `Required
evidence` is the acceptance coverage that must exist before the requirement can
be marked complete in `TODO.md` and `step-by-step.md`.

## Product Decisions

| Decision | Agreed behavior | Delivery section |
| --- | --- | --- |
| Team composition | One player controls a configurable number of figures against another player with a configurable number of figures. | [Match Rules](step-by-step.md#3-match-rules-and-round-lifecycle) |
| Item economy | A game mode may configure fixed loadouts, map pickups, and deterministic seeded draws. | [Items](step-by-step.md#5-item-framework-and-official-items) |
| Desktop and mobile | Desktop uses Tauri; mobile ships first as responsive, offline-capable web. | [Platforms](step-by-step.md#9-desktop-mobile-and-discord) |
| Discord | Presence and invites are optional at runtime and configured through environment values, never committed credentials. | [Platforms](step-by-step.md#9-desktop-mobile-and-discord) |
| Mod sharing | No separate workshop backend. Validated `game.handler.toSettings()` exports and authoritative server settings are the sharing path. | [Persistence](step-by-step.md#8-persistence-sharing-and-replays) |

## Traceability Matrix

| ID | Requirement source | Delivery checklist | Current evidence | Required evidence |
| --- | --- | --- | --- | --- |
| R-01 | TODO Grundprinzip and Phase 1; GDD 2 and 13 | [Baseline and Architecture](step-by-step.md#1-baseline-and-architecture) | `tests/engine_test.ts` covers handler behavior; `tests/turn_system.test.ts` covers active-team persistence. | Fixed-tick browser simulation, a data-driven rule interpreter, and tests proving engine simulation is independent of game rules. |
| R-02 | TODO Phase 2 figure state and shot mechanics; GDD 5 | [Physics](step-by-step.md#2-deterministic-physics-and-arena-safety) | `tests/ui_input.test.ts` covers drag angle/power; `tests/physics_test.ts` covers vector math and circle collision. | Player rotation/angular state round trips; shared forward-vector impulse tests; force-modifier tests. |
| R-03 | TODO Phase 2 movement and drift; GDD 5 | [Physics](step-by-step.md#2-deterministic-physics-and-arena-safety) | `tests/effect_test.ts` covers movement/friction and stop behavior. | Map friction injection, drift steering, and fixed-seed final-position regression fixtures. |
| R-04 | TODO Phase 3; GDD 5 death and collisions | [Physics](step-by-step.md#2-deterministic-physics-and-arena-safety) | Circle/circle and circle/rectangle behavior has physics tests; `tests/setting_effect.test.ts` covers death circles. | Line collision and response tests, all-shape containment tests, and deterministic out-of-bounds elimination tests. |
| R-05 | TODO Phase 4; GDD 4 and 8 | [Baseline and Architecture](step-by-step.md#1-baseline-and-architecture) and [Match Rules](step-by-step.md#3-match-rules-and-round-lifecycle) | `tests/turn_system.test.ts` covers turn progression; `tests/authoritative_game.test.ts` covers authoritative turn ownership. | Item/shot/physics rule transition tests, match-result snapshots, input lock, local rematch, and authoritative rematch tests. |
| R-06 | TODO Grundprinzip, Phase 5, and Phase 6; GDD 6, 7, and 12 | [Data Contracts](step-by-step.md#4-data-contracts-mods-and-maps) | `tests/setting_effect.test.ts` and `tests/authoritative_game.test.ts` cover selected serialization boundaries. | Versioned settings/map/item/hazard/AI/replay schemas, strict validators, rejected untrusted data, and effect-whitelist tests. |
| R-07 | TODO Phase 5; GDD 6 official items | [Items](step-by-step.md#5-item-framework-and-official-items) | No active item pipeline evidence; existing item classes are placeholders. | Item schema, loader, inventory economy, authoritative use, every official item, and mixed-effect regression tests. |
| R-08 | TODO Phase 6; GDD 7 and 12 | [Data Contracts](step-by-step.md#4-data-contracts-mods-and-maps) | `tests/setting_effect.test.ts` verifies map-configured death circles only. | Hazard registry/effect tests, validated Cue Clash/Frostbite/Magma maps, and editor-export conversion tests. |
| R-09 | TODO Phase 7 and Phase 9; GDD 3, 10, and 11 | [Input and UI](step-by-step.md#6-input-ui-and-accessibility) | `tests/ui_input.test.ts`, `tests/direction_arrow.test.ts`, and `tests/scaling_test.ts` cover current mouse, arrow, and scaling behavior. | Configurable actions, aim/charge separation, item UI, controller/touch input, and viewport accessibility tests. |
| R-10 | TODO Phase 8; GDD 8 and 9 | [AI](step-by-step.md#7-ai-and-play-modes) | No runtime AI evidence; editor presets are not gameplay AI. | Seeded easy AI, heuristic medium AI, bounded-search hard AI, and authoritative complete-match tests. |
| R-11 | TODO Phase 10 savegames and Optional replays; GDD 2 and 12 | [Persistence](step-by-step.md#8-persistence-sharing-and-replays) | `tests/authoritative_game.test.ts` covers SQLite persistence, eviction, and reconnect; no replay playback test exists. | Local save-slot tests, validated settings export/import, replay record/playback final-snapshot tests, and replay UI error coverage. |
| R-12 | TODO Phase 10; GDD 3 and 15 | [Platforms](step-by-step.md#9-desktop-mobile-and-discord) | Local browser hotseat works without WebSocket; no package or PWA evidence exists. | Tauri build smoke test, installable offline mobile-web test, and mobile reconnect/touch smoke test. |
| R-13 | TODO Phase 11; GDD 3 and 14 | [Platforms](step-by-step.md#9-desktop-mobile-and-discord) | No Discord runtime or dependency exists. | Disabled-config no-op test, mocked Rich Presence state tests, and validated join/invite tests. |
| R-14 | TODO optional workshop decision; GDD 12 | [Persistence](step-by-step.md#8-persistence-sharing-and-replays) | Scope decision recorded in `TODO.md`; no workshop is required. | Validated settings export and server-distributed settings tests provide the agreed sharing mechanism. |
| R-15 | All TODO/GDD requirements | [Final Hardening](step-by-step.md#10-final-hardening-and-release-readiness) | `bun test` runs the active Bun suite; several historical tests remain empty or commented. | Local/network end-to-end matches, malformed-input coverage, mod-boundary security audit, and clean release verification. |

## Update Rules

- Add a concrete test path to `Current evidence` when a checklist item is
  completed; do not cite commented or assertion-free tests as proof.
- If implementation changes a requirement interpretation, update the relevant
  TODO acceptance criterion, this ledger, and the checklist in one commit.
- Add a new ledger row before implementing a product requirement not represented
  by TODO, the GDD, or an existing row.
