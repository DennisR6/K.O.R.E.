# Engine SDK and KORE SDK Architecture

## 1. Purpose

The generic Engine SDK provides reusable, headless authoring primitives. The
KORE SDK adds Slipstrike/KORE rules, defaults, and runtime composition. Keeping
them separate lets another game author generic worlds and framework metadata
without inheriting KORE teams, players, items, maps, or victory rules.

## 2. Layer model

```text
Engine Runtime
      ↓
Canonical settings contracts
      ↓
Generic Engine SDK (`src/engine/sdk`)
      ↓
KORE Game SDK (`src/kore/sdk`)
      ↓
KORE maps, modes, items, and content
```

Dependencies only travel down this diagram. `src/engine/sdk/**` imports only
generic engine contracts; it must not import `kore`, settings, rules, items,
AI, content, UI, menus, scenes, networking, or browser adapters.

## 3. Responsibility audit

| Responsibility | Previous location | Target layer | Reason / migration risk |
| --- | --- | --- | --- |
| JSON world, entity, structure, effect records | SDK builder | Engine SDK | Generic JSON authoring; low risk. |
| System selection, dependency/order validation | new | Engine SDK | Framework metadata is game-agnostic; new API. |
| Deterministic animation and presentation projection | new | Engine SDK presentation SDK | Visual playback is renderer-neutral and excluded from gameplay snapshots. |
| JSON serialization/validation | mixed SDK code | Engine SDK | Generic boundary; low risk. |
| Team numbers, spawn regions, player materialization | `src/kore/sdk/` | KORE SDK | KORE uses numbered teams and `PlayerSettings`; medium risk. |
| Default map size/friction, containment, game mode | `src/kore/sdk/` | KORE SDK | KORE defaults; medium risk. |
| KORE effects, assets, map structures | `src/kore/sdk/` | KORE SDK | Depend on KORE effect/player contracts; medium risk. |
| `GameHandlerBuilder` runtime construction | `src/engine/runtimeFactory.ts` | Runtime factory | Designated handler construction boundary (milestone 28); match authoring composes via KORE match APIs instead. |
| `GameSettings`, `MapDocument`, system snapshots | existing contracts | Canonical contracts | Stable serialization boundary; do not duplicate. |

## 4. Engine SDK responsibilities

`src/engine/sdk/index.ts` exports `engine`:

- `createWorld()` for generic world JSON;
- `createEntity()`, `createStructure()`, and `createEffect()` for detached
  JSON-safe records;
- `createSystemRegistry()` for deterministic framework selection;
- `validate()` and `buildJson()` for serialization boundaries.

The sibling presentation SDK (`src/engine/presentation-sdk/index.ts`) authors
versioned animation tracks and semantic play/cancel events. Its explicit tick
runtime orders events by priority and submission ordinal, applies declared
interruption policy, and emits detached projection frames. Runtime restoration
contains only presentation state and never changes canonical gameplay settings.

The Engine SDK has no KORE team count, spawn, player, item, turn, map, or
victory assumptions. It does not create the current `GameHandler`: that runtime
currently composes KORE systems and settings, so runtime construction belongs to
the KORE SDK until the runtime itself has a generic host contract.

## 5. KORE SDK responsibilities

`src/kore/sdk/index.ts` exports `kore` and composes `engine.createWorld()`.
It provides `createDefaultMap`, KORE teams/spawns, KORE player generation,
KORE effect factories, KORE validation, `createDefaultFramework`, and
`createHandler`. It deliberately enforces two teams numbered `0` and `1` with
equal figures because that is a KORE game rule, not an Engine SDK rule.

## 6. Canonical data lifecycle

```text
SDK objects → toSettings()/build() → canonical GameSettings/MapDocument
→ JSON.stringify() → runtime construction → runtime toSettings()
→ canonical settings
```

KORE effects accept runtime objects that implement `toSettings()` and embed the
result recursively. The SDK is only an authoring layer; exported JSON never
contains runtime handlers, systems, callbacks, sockets, or render objects.

## 7. System and capability model

`EngineSystemRegistry` is metadata-only. Definitions declare stable IDs,
capabilities they provide/require, optional status, replacements, and ordering
constraints. It rejects duplicate/unknown IDs, ambiguous providers, conflicting
replacements, invalid JSON state, cyclic dependencies, and invalid execution
orders. Construction order is deterministic topological order with system ID as
the tie-break; serialized snapshots retain explicit tick order.

Runtime systems still operate on their minimum capability interfaces. They must
not require concrete `Player` classes; unsupported entities are skipped by the
system that lacks the required capability.

## 8. Framework composition

`engine.createSystemRegistry()` selects generic framework metadata. KORE's
`createDefaultFramework()` declares its playback → physics → boundary → game
state-manager profile through that selector. The current KORE runtime factory
continues to use `GameHandlerBuilder.defaultSystems()` so existing behavior and
serialized system contracts remain unchanged.

Another game can register its own system definitions and build a framework
without importing KORE. A future generic runtime host may consume the same
framework snapshot to instantiate actual systems through a game-provided
catalog.

## 9. Extension and generated artifacts

The source of truth for serializable system metadata is
`src/engine/contracts/systemSettings.ts`; generic SDK values are JSON-safe.
KORE canonical settings remain in their existing contracts. This separation is
the future generation boundary for TypeScript builders, JSON Schema, validators,
JSDoc/TypeDoc, examples, `.explain()` output, and build-specific SDK entries.
Do not create parallel manually-maintained schemas.

## 10. Stability guarantees

Stable public contracts are canonical `GameSettings`, `MapDocument`, versioned
system snapshots, `engine`, and `kore`. Builder internals, runtime system
implementations, and KORE default composition details may change provided their
documented canonical outputs and stable IDs remain compatible.

## 11. Forbidden dependency directions

- Engine SDK must not import KORE SDK/content or KORE game domains.
- Canonical contracts must not import SDK builders.
- KORE SDK may import Engine SDK and canonical contracts.
- Runtime adapters (browser, menu, server, WebSocket, SQLite) must not be
  imported by either authoring SDK.

`tests/engine_sdk_architecture.test.ts` enforces the Engine SDK import boundary.

## 12. Examples

The supported authoring guide is [`docs/sdk-authoring-guide.md`](docs/sdk-authoring-guide.md).
Runnable Engine SDK, KORE map/item, match lifecycle, UI, and audio examples are
in [`examples/`](examples/) and are compiled and executed by
`tests/sdk_examples_ci.test.ts`.

```ts
import { engine } from "./src/engine/sdk/index.js";

const world = engine.createWorld({ id: "demo", worldSize: { x: 320, y: 180 } })
  .addEntity(engine.createEntity({ id: "token", capabilities: ["position"] }))
  .addStructure(engine.createStructure({ shape: "rectangle", x: 0, y: 0, w: 320, h: 180 }))
  .build();
```

```ts
import { kore } from "./src/kore/sdk/index.js";

const blue = kore.createTeam({ teamNr: 0, name: "Blue", playerCount: 2 });
const map = kore.createDefaultMap({ name: "Ice Arena" })
  .addTeam(blue)
  .addPlayerSpawn({ team: blue, x: 40, y: 120, w: 140, h: 160 })
  .addPlayerSpawn({ teamNr: 1, playerCount: 2, x: 620, y: 120, w: 140, h: 160 })
  .addRectangle({ x: 300, y: 120, w: 40, h: 180, effects: [kore.effects.damage(10)] })
  .build();
```

## 13. Final SDK-only release gate

Supported authoring is limited to the Engine SDK entry points, the KORE SDK
entry point, and the documented generic UI/audio sub-entry points. Runtime
factories, snapshot restoration, replay reconstruction, approved map loading,
server persistence, browser bootstrap, and Tauri packaging are explicit
application/platform boundaries. `ItemLoader` and `ItemValidator` are internal
runtime/mod-loading boundaries, not published mod imports.

Internal engine implementation may continue to import internal systems,
effects, settings, rules, and entity modules. The restriction is on supported
authoring, examples, application composition, mods, and non-allowlisted
adapters. `tests/sdk_only_release_gate.test.ts` enforces removed-file,
constructor, example-import, application-boundary, documentation, and roadmap
checks. Run `bun run sdk:release-gate` for the aggregate source, qualification,
browser, build, and desktop release verification.
