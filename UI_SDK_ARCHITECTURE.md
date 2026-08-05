# Generic UI SDK Architecture

## 1. Purpose

The UI SDK treats a UI as an explicit engine-style composition: serializable
entities, capability-driven systems, deterministic framework metadata, manual
`tick()`, and manual `draw()`. It is not a DOM framework, scene loop, or
separate widget runtime.

## 2. Layer model

```text
Engine SDK → Generic UI SDK → game-specific UI SDK → concrete menus/overlays
```

`src/engine/ui-sdk/**` may import Engine SDK/contracts only. It must not import
KORE settings/content, browser adapters, p5, menus, scenes, or server code.
The Engine SDK does not import the UI SDK.

## 3. Responsibility audit

| Existing responsibility | Current location | Target | Migration |
| --- | --- | --- | --- |
| Generic UI contracts/runtime/systems | absent | UI SDK | New explicit runtime. |
| System metadata and ordering | `src/engine/sdk/systemRegistry.ts` | Engine SDK | Reused directly. |
| Browser/p5 event collection | `src/main.ts` | Host runtime | Unchanged. |
| KORE visual rendering/assets/callback routes | `src/kore/ui/KoreMainMenuSurface.ts` | KORE UI adapter | Reconstructs the SDK-authored production menu and retains KORE rendering/callback dispatch. |
| Gameplay drag-to-shot and overlays | `src/systems/UiSystem.ts`, `src/ui/*` | KORE gameplay UI | Not migrated. |
| Main-menu interaction | `src/kore/ui/mainMenu.ts` + `KoreMainMenuSurface.ts` | KORE UI production composition | Every production menu screen uses generic UI settings/runtime interaction. |

## 4. Passive engine lifecycle

`UiRuntime` owns no timer, DOM listener, animation frame, `start`, `stop`, or
pause API. Hosts call `tick(input, deltaTime)` to advance state and
`draw(renderer)` to render current state. Stopping calls implicitly pauses the
UI. `draw()` is pure with respect to persistent UI settings.

## 5. Capability model

The runtime uses small composed capabilities: position/rect, visibility,
enabled state, focus, pointer target, pressable action, text content, and text
input. Systems use structural guards such as pointer-target or text-input
capability checks, never `instanceof Button` or `instanceof TextInput`.
Unsupported elements are skipped safely.

## 6. System model

The default deterministic order is:

1. `ui.visibility`
2. `ui.layout`
3. `ui.input.pointer`
4. `ui.focus`
5. `ui.input.keyboard`
6. `ui.text-input`
7. `ui.button`
8. `ui.navigation`
9. `ui.render`

The first eight participate in explicit ticks; `ui.render` participates only
in explicit draw calls. The framework is selected by `EngineSystemRegistry`,
which validates IDs, capabilities, dependencies, duplicates, replacements, and
order before producing serializable metadata.

## 7. Entity model

Buttons, labels, and text inputs are `UiElementSettings` reconstructed into
runtime elements. Screens own elements and layouts. They are not special objects
outside the runtime and retain no DOM nodes, renderer handles, listeners, or
browser events in settings.

Containers are recursive, layout-only elements. `ui.container()` accepts child
elements and a serializable `absolute`, `horizontal`, or `vertical` layout.
Padding, gap, `justify`, `align`, and `stretch` are resolved deterministically
in declaration order. Hidden flow children collapse; disabled children retain
their space; overflowing layouts preserve requested sizes and fall back to
start justification. Containers never require a renderer method.

```ts
const actions = ui.container({
  id: "actions",
  rect: { x: 0, y: 0, width: 740, height: 64 },
  layout: ui.layout.horizontal({ gap: 16, justify: "space-evenly", align: "center" }),
  elements: [ui.button({ id: "play", text: "Play", rect: { x: 0, y: 0, width: 132, height: 58 }, action: ui.action.emit("play") })],
});
```

## 8. Input lifecycle

The host supplies platform-neutral `UiInput`: normalized pointer coordinates,
press transitions, key names, and text input. The generic runtime never
registers global listeners. Pointer hit testing drives focus; focused text input
receives text/backspace; pressable elements queue serializable actions.

## 9. Rendering lifecycle

`UiRenderer` is a small semantic port (`drawText`, `drawButton`,
`drawTextInput`). A host renderer maps those calls to canvas, p5, terminal, or
another backend. Rendering consumes read-only current state and cannot advance
navigation, focus, text, or layout state.

## 10. Serialization lifecycle

```text
UiMenuSettings → UiRuntime → explicit tick/input changes → toSettings()
→ JSON → UiRuntime.fromSettings()
```

Settings preserve active screen, history, visibility/enabled state, focusable
input values, layouts, semantic actions, themes, and framework metadata. Pending
pointer references, queued commands, renderers, and host callbacks are runtime
only.

## 11. Engine switching

A host may stop calling a menu runtime, create/use a KORE game handler, then
restore `UiRuntime.fromSettings(menu.toSettings())`. Multiple menu/game runtime
instances are independent; no global UI loop or singleton is required.

## 12. UI actions

Actions are JSON-safe semantic commands: navigate, back, emit (including values
from named text inputs), set/select a value, set enabled/text state, or toggle
visibility. Arbitrary callbacks are not serialized. Hosts drain emitted commands
and translate them into application-specific behavior.

## 13. Framework composition

`ui.createDefaultFramework()` uses the generic `EngineSystemRegistry`; it does
not introduce a second registry. The registry preserves deterministic execution
order separately from ID-sorted serialized snapshots. Future UI profiles may
select optional systems or declared replacements through the same registry.

## 14. Generic versus KORE responsibilities

The UI SDK has no KORE labels, colors, routes, maps, teams, or game modes.
KORE pages retain their renderer/theme and translate generic `emit` commands.
The production KORE main menu is the current full composition: its serialized
settings use generic strings, while `menuVocabulary.ts` authors KORE screens,
IDs, styles, routes, intents, difficulty, and commands exclusively through
enums before the KORE surface parses them for callback dispatch.

The production KORE gameplay HUD follows the same boundary through
`src/kore/ui/gameHud.ts`: generic actions remain serialized strings, while
`hudCommands.ts` and `hudVocabulary.ts` author and narrow every KORE HUD command,
identifier, style, label, and closed slot through enums before routing commands
to gameplay authority. Neither vocabulary changes the generic UI SDK.

Hosts may project dynamic state without reaching into element implementations:
`UiRuntime.dispatch()`, `setElementVisible()`, `setElementEnabled()`, and
`setElementAction()` use the same validated generic action/settings contracts.
The KORE HUD uses these capabilities to apply its immutable gameplay projection;
they do not add KORE concepts to the generic SDK.

## 15. Extension and generation model

The source of truth is `UiMenuSettings`, `UiElementSettings`, `UiAction`, and
Engine system metadata. These JSON-safe contracts can later generate TypeScript
builders, schema, validators, TypeDoc/JSDoc, examples, editor metadata, and
`.explain()` output without a separate schema. `UiRuntime.explain()` and
`UiMenuBuilder.explain()` provide the initial explanation seam.

## 16. Stability guarantees and examples

Stable public contracts are `ui`, UI settings/actions/layouts, the framework
IDs, and explicit lifecycle methods. Runtime element implementation and renderer
adapters may change while preserving settings semantics.

```ts
import { ui } from "./src/engine/ui-sdk/index.js";

const settings = ui.createMenu({ id: "menu", size: { width: 800, height: 450 } })
  .addScreen(ui.screen({ id: "main", layout: ui.layout.vertical({ gap: 16 }), elements: [
    ui.text({ id: "title", text: "My Game", rect: { x: 0, y: 0, width: 240, height: 40 } }),
    ui.button({ id: "play", text: "Play", rect: { x: 0, y: 0, width: 180, height: 44 }, action: ui.action.navigate("setup") }),
  ] }))
  .addScreen(ui.screen({ id: "setup", elements: [] }))
  .build();
const restored = ui.fromSettings(JSON.parse(JSON.stringify(ui.fromSettings(settings).toSettings())));
```

A future KORE UI extension may wrap selected `ui` factories, provide a KORE
theme, and translate emitted commands into local/online/map-selection routes
without adding any KORE dependency to the generic UI SDK.

## 17. Browser debug sandbox

The standalone generic UI SDK sandbox is available only at `?debug=ui` (the
diagnostic alias `?debugui=1` is also accepted). Its browser host is
`src/debug/uiSandbox.ts`, not the generic SDK: it adapts p5 pointer/keyboard
events into `UiInput`, explicitly calls `tick()` and `draw()`, and renders host
diagnostics. The screens themselves are authored exclusively through the public
`ui` SDK. It exercises component states, pointer/focus handling, text entry,
navigation/history, JSON snapshot reconstruction, lifecycle switches,
independent runtimes, and validation failures without booting KORE gameplay.
