# KORE Main-Menu SDK Composition

## Authoritative source

`src/kore/ui/mainMenu.ts` is the sole production definition of the KORE main
menu. `createMainMenuComposition().build()` compiles the landing, main, map,
online-map, KI difficulty, KI-map screens, generic UI framework metadata, and
persistent KORE menu-music intent into `KoreMainMenuSettings`.

`src/kore/ui/KoreMainMenuSurface.ts` is an adapter, not a second menu: it
reconstructs `UiRuntime` from those built settings, passes explicit normalized
input to `tick()`, projects elements through a KORE `UiRenderer`, drains
semantic commands, and exposes an `ISoundEmitter` to the application audio
mixer. It contains no menu hitboxes or canonical button labels.

## Build and runtime lifecycle

```ts
const settings = createMainMenuComposition().build();
const menu = createKoreMainMenuSurface(callbacks, settings);

menu.updateMouse(x, y);
menu.handleMousePressed(); // explicit UiRuntime.tick()
menu.tick(1, 0);           // timer/prompt state only
menu.draw(renderer);       // pure UI draw projection
```

`buildJson()` is a debugging/sharing artifact. The router passes the object
from `build()` directly to the surface. `surface.toSettings()` returns the same
schema with current UI state; reconstruction restores screen/history/visibility
without replaying consumed confirmation sounds. Persistent menu music is emitted
again by the reconstructed surface.

## Commands, navigation, and audio

The UI SDK owns landing/main/map/difficulty navigation via declared `navigate`
and `back` actions. `menuVocabulary.ts` owns the enum-backed KORE commands,
screens, element IDs, styles, map intents, and difficulty values; it also parses
generic UI strings before they enter `KoreMainMenuSurface`. The generic UI SDK
continues to serialize ordinary strings and is not changed by this KORE layer.
External transitions are semantic commands handled by the KORE surface/router:

- `kore.menu.start-local-game`
- `kore.menu.open-online`
- `kore.menu.open-battle`
- `kore.menu.open-ai`
- `kore.menu.open-local-maps`
- `kore.menu.open-ai-maps`
- `kore.menu.select-map`

The composition includes a persistent `kore.music.menu` request. The surface
maps accepted top-level menu actions to transient `kore.ui.confirm` commands;
it never imports `AudioManager`. The host collects its `ISoundEmitter` through
`AudioRuntime`, submits its batch to `ApplicationAudioMixer`, and applies the
single result via `BrowserAudioOutput`. Match music has higher priority and
replaces menu music deterministically.

## KORE theme and adapters

The KORE renderer adapter in `KoreMainMenuSurface.ts` owns the title background,
colors, text size, and semantic `style` projection. Generic `UiRuntime` has no
p5, DOM, KORE labels, or asset dependency. Browser listeners remain in
`src/main.ts`; `src/main.ts` converts browser coordinates to world input before
forwarding it to the active handler.

## Extending the menu

1. Add a `ui.screen()` or element in `src/kore/ui/mainMenu.ts`.
2. Use `ui.action.navigate()`/`back()` for internal screens and
   `ui.action.emit()` for application work.
3. Add KORE visual styling in the renderer adapter, not generic UI SDK code.
4. Route a new semantic command in `KoreMainMenuSurface.handleCommands()` and
   let `LocalMatchSceneRouter` retain gameplay ownership.
5. For a sound, add a KORE semantic ID/preset in `src/kore/audio.ts`, reference
   it from composition/surface, and test its aggregated command. Do not use an
   asset URL or `AudioManager` in menu settings.

## Verification

`tests/kore_main_menu_composition.test.ts` covers build/JSON/state roundtrip and
purity. Existing menu-router tests cover all catalog, KI, online, and callback
routes. `tests/browser/browser_main_menu_sdk.e2e.test.ts` verifies the real
production build, SDK navigation/back, audio commands, and local-match handoff.

## Production parity and legacy removal

| Previous behavior | SDK replacement | Automated coverage | Browser coverage | Status |
| --- | --- | --- | --- | --- |
| Landing any-press transition and delayed prompt | `landing-start` plus explicit surface timer visibility | composition test | startup/menu SDK E2E | preserved |
| Five exact main-button rectangles | `main` screen `ui.button()` records | menu routing tests | startup/menu SDK E2E | preserved |
| Local, online, battle, KI map selection/filtering | Static generated map screens and semantic payloads | menu/catalog/KI tests | map catalog and AI E2E | preserved |
| Difficulty selection and back history | `difficulty` + generic navigation/back actions | human-vs-AI/composition tests | AI E2E | preserved |
| Menu music and confirmation cue | built persistent audio + composition command mapping | audio/composition tests | audio/menu SDK E2E | preserved |
| Immediate menu-to-match audio handoff | router queue capture + shared application mixer | audio pilot tests | audio/menu SDK E2E | preserved |

The manual `src/menu/Menu.ts`, page classes, numeric page enum, and
`MenuTypes.ts` were removed. There is no production fallback menu path.
