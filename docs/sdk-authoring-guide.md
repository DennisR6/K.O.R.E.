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
allowlist. `kore.validate()` is the public settings validation wrapper; direct
settings-validator imports are not part of the published example contract.

### Matches and lifecycle

Use `kore.createGameMode()`, `kore.createMatchDefinition()`, and
`kore.validateMatchDefinition()` to create the detached match boundary. Match
phase and win-condition vocabulary is exposed as `kore.types.rulePhase` and
`kore.types.winCondition`; consumers do not need to import `src/rules`.
A runtime is created with `kore.createRuntimeMatch()` or `kore.createHandler()`.
The supported lifecycle is:

```ts
const definition = kore.createMatchDefinition({ settings, gameMode, seed: 12345 });
const wireCopy = JSON.parse(JSON.stringify(definition));
kore.validateMatchDefinition(wireCopy);
const handler = kore.createRuntimeMatch(wireCopy);
const packet = handler.simulateTurn(actorId, angle, power);
const snapshot = handler.toSettings();
const restored = kore.restoreHandler(snapshot);
```

`simulateTurn()` does not mutate the authoritative handler. `resolveTurn()`
commits an accepted result. `toSettings()` and `restoreHandler()` are the
persistence, replay, and reconnect boundary. Match runtime construction and
direct constructors such as `GameHandlerBuilder` are application/runtime
boundaries, not content authoring APIs.

### UI, audio, and AI

The generic UI SDK is explicitly driven: build settings with `ui.createMenu`
and `ui.screen`, reconstruct with `ui.fromSettings`, then call `tick(input)`,
`draw(renderer)`, and `drainCommands()`. It owns no browser listeners or loop.

The generic audio SDK accepts semantic commands from `audio.emitter()` and
processes them through `audio.createRuntime(settings)`. The supported KORE
audio surface is `kore.audio`, including sound IDs, bus presets, settings, and
semantic commands. `src/kore/audio.ts` is its implementation module, not the
preferred published import. Browser media is owned by the application output
port.

AI profiles are detached settings from `kore.ai.createSettings()`. Use
`kore.ai.createProducer()` or `createTurnEmitter()` at the application/runtime
boundary. Decisions still pass through the same validated input emitter used
by human and server paths.

## Mod Authoring

Map mods should export a function that builds a fresh map from stable IDs and
validated data. Do not mutate a previously built snapshot. Item mods should
declare only JSON values with `kore.createItem()`, serialize them at the wire
boundary, and re-author/revalidate them through the same public function.
`duration: { type: "instant", value: 0 }` means the item activation is
immediate; persistent effects such as a shield own their remaining state in
the runtime effect snapshot.

`ItemLoader` and `ItemValidator` are internal runtime/mod-loading boundaries,
not public SDK authoring exports. They are used by built-in/server integration
and enforce the same declarative rules, but published mods must not import
`src/item/*` directly. A mod cannot introduce a runtime effect by putting a
function or module path in an item document.

## Migration

| Old pattern | Supported replacement |
| --- | --- |
| Direct legacy handler construction | `kore.createHandler(settings)` or `kore.createRuntimeMatch(definition)` |
| Hand-written map settings | `kore.createDefaultMap(...).build()` |
| Runtime item objects in content | `kore.createItem()` and JSON round-trip |
| Browser UI hitboxes and listeners | `ui.createMenu()` plus explicit `tick()` input |
| Direct audio playback | semantic `audio.command` / `kore.audio.command` output |
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
- import `ItemLoader`, `ItemValidator`, direct settings validators, or direct
  runtime constructors from internal `src/item`, `src/settings`, or engine
  modules in published content;
- add manual HUD/menu hitboxes or direct `AudioManager` calls to gameplay
  scenes;
- treat generated `dist/` output as the authoring source of truth.

The source code and focused tests remain authoritative when this guide and a
generated API page disagree.

## Final SDK-Only Release Status

The final release gate applies the SDK-only rule to supported authoring,
application composition, mods, examples, and non-allowlisted adapters. It does
not require internal engine implementation files to import only SDK modules.

Supported authoring entry points are:

- `src/engine/sdk/index.ts` for generic worlds and system metadata;
- `src/engine/ui-sdk/index.ts` for JSON UI menus and explicit input ticks;
- `src/engine/audio-sdk/index.ts` for semantic audio commands and runtimes;
- `src/kore/sdk/index.ts` for KORE maps, items, matches, AI, audio, and runtime
  restoration through the `kore` object.

Supported runtime boundaries are `kore.createHandler()`,
`kore.createRuntimeMatch()`, `kore.restoreHandler()`, replay reconstruction,
approved map loading, authoritative server persistence/restoration, and the
browser/Tauri platform adapters. `ItemLoader` and `ItemValidator` remain
internal server/built-in integration boundaries; published mods use
`kore.createItem()` instead.

The release command is:

```sh
bun run sdk:release-gate
```

It runs the SDK-only source guard, example typecheck/execution, Milestone-39
qualification, TypeScript, production build, fast suite, browser smoke, and
desktop packaging checks. A new example must be added to
`tests/sdk_examples_ci.test.ts`; a new map, item, or mode must cross its public
KORE authoring and serialization boundary; an application adapter must be
classified as a documented runtime/platform boundary and covered by its
focused gate.
