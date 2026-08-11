# Engine Extraction Inventory and Coupling Audit

Date: 2026-03-30
Source branch: `engine-extraction` (already checked out)
Source repository: `/home/eugen/projekte/kore`

## Phase 1 inventory

Classification uses the question: could the module reasonably be used without the KORE game?

| Area | Classification | Scope |
|---|---|---|
| `src/engine/contracts`, `src/engine/sdk`, `src/engine/audio-sdk`, `src/engine/presentation-sdk`, `src/engine/ui-sdk` | Engine Core / Generic SDK/API | JSON-safe capabilities, registries, generic UI/audio/presentation contracts, system metadata, and detached world/entity state. These are the strongest extraction candidates. |
| `src/physics` | Engine Core | Vector, collision, impulse, CCD, friction, and physics contracts. Currently coupled to `EntityManager` and game settings and therefore requires boundary work. |
| `src/entity`, `src/structures` | Generic Runtime, ambiguous | Runtime entities and geometry are reusable in principle, but `Player`, inventory, item effects, KORE asset types, and game snapshots are mixed into the same runtime. Requires a generic entity/actor boundary and injected factories. |
| `src/systems` | Generic Systems, ambiguous | Physics, movement, transform, numeric, participation, playback, and effect dispatch are reusable. UI, round, winning, boundary, AI registration, and game-state systems are game/framework mixtures. |
| `src/effects` | Generic Runtime / ambiguous | Serializable effect primitives and dispatch contracts are reusable, but item-effect types, player settings, KORE target contracts, and game semantics are embedded. Requires a generic effect registry and target/host interfaces. |
| `src/replay`, `src/persistence`, `src/contracts` | Generic Serialization / Snapshot / Replay, ambiguous | Validation and document plumbing are reusable, but replay currently knows KORE rules, items, `GameSettings`, and `GameHandler`. Requires generic action/snapshot ports with game adapters. |
| `src/input` | Generic Runtime / Game-Specific UI | Controller primitives are potentially generic; KORE action vocabulary and `UiSystem` pointer handling are game-specific. Split device input from game action mapping. |
| `src/environment`, `src/hazards` | Generic Systems, ambiguous | Timed mechanics and force primitives could be generic; current map/document and settings contracts are KORE-specific. Move generic hazard lifecycle contracts below game map loading. |
| `src/ai` | Game-Specific Systems | AI decisions target KORE `Handler`, rules, players, items, and replay. Not part of a generic engine extraction unless a separate generic decision/simulation API is introduced. |
| `src/item`, `src/rules`, `src/sdkMigration` | Game-Specific Runtime / Content | KORE item economy, game phases, modes, and migration behavior. Must remain game-side; generic effect/capability contracts may be consumed from the engine. |
| `src/settings`, `src/content`, `src/mods`, `src/migrations` | Game-Specific Content / Serialization adapters | Maps, teams, KORE defaults, official content, map catalog, mod package semantics, and KORE migrations. Keep game-side. |
| `src/kore` | Game-Specific SDK/API and UI | KORE composition, official vocabulary, game HUD/menu, KORE audio and presentation adapters. It consumes generic SDK code and must not move into the engine. |
| `src/scenes`, `src/main.ts`, `src/menu`, `src/net`, `src/server`, `src/discord` | Game-Specific Runtime / UI / Infrastructure | Browser game, network authority, deployment, operator dashboard, and KORE presentation. Keep game-side. |
| `src/assetManager`, `src/audio`, `src/i18n`, `src/ui` | Assets / Game-Specific UI | Browser asset loading, p5 rendering, KORE language and map-builder concerns. Only renderer-independent generic interfaces belong in the engine. |
| `tests/engine_*`, physics/effect/system contract tests | Generic Tests, ambiguous | Reusable tests should follow extracted contracts; tests using KORE maps/items/official effects remain game tests. A fixture package is needed before filtering history. |
| `tests/ai_*`, item/map/content/network/browser/menu/server tests | Game-Specific Tests | Depend on KORE fixtures or browser/server infrastructure. Keep in game repository. |
| `scripts`, `examples`, `src-tauri`, root browser/server files | Tooling / Build Infrastructure | Mostly game build/deployment. Generic SDK examples and package build scripts can be recreated in the extracted package. |
| `README.md`, `SDK_*`, `UI_*`, `AUDIO_*` | Documentation | SDK architecture documents contain reusable material; gameplay/GDD/release docs are game-only. |

## Ambiguous modules requiring review

- **`src/engine/Handler.ts` and `src/engine/types.ts`**: central runtime currently imports KORE settings, `Player`, item inventory/targets, rules, AI, language, gameplay feedback, and official item rewards. It cannot be extracted as-is. Smallest viable boundary: extract a generic world/step/snapshot host and inject entity, effect, system, action, and serialization registries; keep the KORE `GameHandler` orchestration adapter in the game repository.
- **`src/entity/Player.ts` / `EntityManager.ts`**: runtime objects own KORE inventory and item effects and use `AssetList`. They are not independent. Smallest boundary: generic `Entity`/component snapshot plus injected runtime factory; keep `Player` and `EntityManager` adapter in game until generic consumers exist.
- **`src/physics/*.ts`**: reusable algorithms import `EntityManager` and KORE friction settings. Smallest boundary: define generic body collection/body interfaces and move friction/solver settings into engine contracts.
- **`src/systems/systemSettings.ts`**: the system registry hardcodes AI and KORE/game systems. This is an architectural blocker for extraction. Smallest boundary: generic registry with game-side registration; preserve stable IDs as data contract.
- **`src/systems/UiSystem.ts`**: uses KORE input vocabulary and game shot semantics. Keep it game-side; expose generic pointer/input ports only if a consumer requires them.
- **`src/replay/player.ts` / `replay/types.ts`**: replay documents encode KORE item and rule actions and restore `kore` handlers. Keep KORE replay adapter game-side; extract only generic deterministic action-log and snapshot validation primitives.
- **`src/effects/types.ts` / `src/effects/effects.ts`**: effect factory includes KORE/game effect types and item targets. Extract generic effect registry/dispatcher contracts, not the current catalog wholesale.
- **`src/structures/types.ts`**: geometry is reusable but structure effects and settings import game contracts. Extract geometry/collision contracts and keep KORE structure adapters separate.
- **`src/environment` / `src/hazards`**: potentially generic lifecycle mechanics, but current serialization is tied to KORE map/settings documents. Keep until generic contracts are proven by standalone fixtures.

## Phase 2 dependency verdict

The current source does **not** satisfy the required dependency direction. Confirmed reverse coupling includes:

- `src/engine/Handler.ts` -> entity, effects, item, rules, AI, language, KORE feedback, and official-item reward code.
- `src/engine/types.ts` -> entity, settings, rules, item target/types, and KORE snapshot concerns.
- `src/engine/runtimeFactory.ts` -> `GameHandler` and KORE `GameSettings`.
- `src/engine/RenderContext.ts` and `drawingEngine.ts` -> KORE asset manager and UI/camera code.
- `src/engine/sdk/entityState.ts` -> physics, while physics -> `EntityManager` and settings.
- `src/systems/systemSettings.ts` -> AI and concrete game systems.
- `src/systems/UiSystem.ts` -> KORE input SDK.
- `src/replay/player.ts` -> KORE SDK, KORE rules, and game emitter.
- `src/entity/Player.ts` -> KORE item runtime, inventory, effects, and KORE assets.
- `src/item/types.ts` -> generic UI SDK (the item schema currently owns UI metadata).
- `src/rules/types.ts` -> item types.

Severity: the `Handler`/system registry/runtime model is an **architectural blocker**, not a trivial import cleanup. The generic SDK subtree is already close to independent, but the full playable runtime is not.

## Required extraction shape

The least disruptive target is a standalone package containing the proven generic SDK/contracts, physics primitives, geometry primitives, generic system interfaces/registries, and generic deterministic serialization helpers. KORE `GameHandler`, `Player`, item/rule/AI systems, maps, official effects, UI surfaces, server, browser assets, and game tests should remain consumers.

Before any history filtering, the package must compile and test from a directory where all KORE modules are absent. The current repository has not yet passed that gate.

## Current verdict

`STANDALONE ENGINE BLOCKED`

This is an inventory/dependency report only. No source code was modified during Phase 1/2.
