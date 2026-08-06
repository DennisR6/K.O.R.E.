# KORE SDK Authoring Guide

This guide describes the supported authoring boundary for KORE maps, matches,
items, UI, audio, and AI. The examples in [`../examples/`](../examples/) are
compiled and executed by CI.

## Layering

Use the SDK layers from the bottom up:

1. **Engine SDK** (`src/engine/sdk/index.ts`) authors generic JSON-safe worlds,
   entities, structures, effects, and system metadata. It has no KORE or
   browser dependency.
2. **KORE SDK** (`src/kore/sdk/index.ts`) authors KORE teams, players, maps,
   items, effects, game modes, and match definitions. It converts authoring
   data to validated engine settings.
3. **Application adapters** connect validated settings to a handler, browser
   renderer, server, audio output, or input device.

Authoring code must not import runtime browser, server, or device adapters.
Runtime code must cross the boundary through serialized settings and the
documented factories.

## Supported Surface

### Engine worlds

`engine.createWorld({ id, worldSize })` returns a builder with
`setBackground`, `addEntity`, `addStructure`, `addEffect`, `useFramework`,
`build`, and `buildJson`. `engine.createEntity`, `createStructure`, and
`createEffect` validate that records are JSON-safe. Use
`engine.createSystemRegistry()` for declarative system metadata.

### KORE maps and items

`kore.createDefaultMap()` returns a `KoreMapBuilder`. Add teams and spawn
regions, then add structures, hazards, world effects, item documents, and item
economy settings. `build()` returns validated `GameSettings`; use
`buildMapDocument()` when a revisioned map document is required.

`kore.createItem()` creates a declarative `ItemDocument`. Item effects are
written as `{ type, value }` data and are checked against the SDK effect
allowlist. Local mods must still pass through `ItemValidator` and
`ItemLoader.registerLocalMod()`.

### Matches and lifecycle

Use `kore.createGameMode()`, `kore.createMatchDefinition()`, and
`kore.validateMatchDefinition()` to create the detached match boundary. A
runtime is created with `kore.createRuntimeMatch()` or `kore.createHandler()`.
The supported lifecycle is:

```ts
const definition = kore.createMatchDefinition({ settings, gameMode, seed: 12345 });
const wireCopy = JSON.parse(JSON.stringify(definition));
validateKoreMatchDefinition(wireCopy);
const handler = kore.createRuntimeMatch(wireCopy);
const packet = handler.simulateTurn(actorId, angle, power);
const snapshot = handler.toSettings();
const restored = kore.restoreHandler(snapshot);
```

`simulateTurn()` does not mutate the authoritative handler. `toSettings()` and
`restoreHandler()` are the persistence, replay, and reconnect boundary.

### UI, audio, and AI

The generic UI SDK is explicitly driven: build settings with `ui.createMenu`
and `ui.screen`, reconstruct with `ui.fromSettings`, then call `tick(input)`,
`draw(renderer)`, and `drainCommands()`. It owns no browser listeners or loop.

The audio SDK accepts semantic commands from `audio.emitter()` and processes
them through `audio.createRuntime(settings)`. KORE sound IDs and bus presets
come from `koreAudio`; browser media is owned by the application output port.

AI profiles are detached settings from `kore.ai.createSettings()`. Use
`kore.ai.createProducer()` or `createTurnEmitter()` at the application/runtime
boundary. Decisions still pass through the same validated input emitter used
by human and server paths.

## Mod Authoring

Map mods should export a function that builds a fresh map from stable IDs and
validated data. Do not mutate a previously built snapshot. Item mods should
declare only JSON values, register supported effect names with an
`ItemValidator`, and load with `ItemLoader.registerLocalMod()`.

The item loader distinguishes `built-in` and `local-mod` sources, rejects
duplicate IDs, rejects executable fields, and returns defensive copies. A mod
cannot introduce a runtime effect by putting a function or module path in an
item document.

## Migration

| Old pattern | Supported replacement |
| --- | --- |
| Direct legacy handler construction | `kore.createHandler(settings)` or `kore.createRuntimeMatch(definition)` |
| Hand-written map settings | `kore.createDefaultMap(...).build()` |
| Runtime item objects in content | `kore.createItem()` plus `ItemLoader` |
| Browser UI hitboxes and listeners | `ui.createMenu()` plus explicit `tick()` input |
| Direct audio playback | semantic `audio.command` / `koreAudio.command` output |
| Unvalidated AI actions | `kore.ai.createTurnEmitter()` and the shared emitter boundary |
| Editor JSON passed directly to the engine | `validateEditorMapDocument()` then `convertEditorMapDocument()` |

Legacy constructors and duplicate factories are intentionally not public
authoring APIs. Existing runtime adapters may use their internal factory
boundary, but new content should not depend on it.

## Unsupported Internals

Do not:

- construct `Player`, runtime effects, or runtime structures directly for
  production content;
- import `GameHandlerBuilder` outside its runtime factory boundary;
- import `bun:sqlite`, server modules, p5, DOM APIs, or browser audio APIs into
  Engine/KORE SDK modules;
- pass editor `mapData` directly to `GameHandlerBuilder.fromSettings()`;
- use executable item fields, arbitrary effect names, or unvalidated JSON;
- add manual HUD/menu hitboxes or direct `AudioManager` calls to gameplay
  scenes;
- treat generated `dist/` output as the authoring source of truth.

The source code and focused tests remain authoritative when this guide and a
generated API page disagree.
