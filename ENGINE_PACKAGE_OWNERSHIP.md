# Standalone Engine Package Ownership

Extraction source: `engine-boundary-complete` (`d40d517`)
Owner: Coffee Maker Studio

## Package map

| Package | Owned source | Dependencies | Tests |
|---|---|---|---|
| `@coffeemakerstudio/roast` | `src/engine/contracts/**`; `src/engine/sdk/**`; generic trigger, registry, JSON/world builder, lifecycle, counter, numeric, transform, movement, participation, effect metadata, and runtime-state contracts; generic deterministic helpers needed by these modules | none for runtime; `src/utils/random.ts` is vendored/moved with the package if required | `engine_counter_*`, `engine_effect_*`, `engine_entity_state`, `engine_system_registry`, `engine_trigger_contract`, generic SDK portions of `engine_sdk_architecture` |
| `@coffeemakerstudio/bean` | Generic physics contract currently at `src/physics/physics.ts`; it supplies vector, shape, body, contact, and physics-strategy contracts used by Roast state capabilities | Roast contracts; no KORE source | physics contract tests that exercise the generic contract; no KORE `defaultPhysics` or Player tests |
| `@coffeemakerstudio/drip` | `src/engine/ui-sdk/**`; generic menu settings/runtime, layout, pointer/focus/keyboard navigation, and renderer-neutral UI contracts | Roast system metadata/contracts | `ui_sdk.test.ts`, `ui_sdk_containers.test.ts` |
| `@coffeemakerstudio/crema` | No source is promoted in the first extraction. The repository has no validated KORE-independent team/map/player/gameplay layer at this boundary. A package placeholder may be added for workspace stability, but it must not contain KORE concepts. | Roast and Bean only when future generic primitives are proven | none in first extraction |

Generic audio and presentation SDKs (`src/engine/audio-sdk/**` and
`src/engine/presentation-sdk/**`) are cross-cutting, renderer-neutral runtime
contracts. They belong in Roast for the initial repository because they do not
require Drip UI and are already validated independently. Their tests are
`tests/audio_sdk.test.ts` and `tests/presentation_sdk.test.ts`.

## Not extracted

The following remain KORE-owned and are excluded from the history-filtered
repository:

- `src/kore/**`, including KORE runtime orchestration, replay, UI surfaces,
  factories, content, and vocabulary.
- `src/entity/**`, `src/effects/**`, `src/structures/**`, `src/systems/**`,
  `src/rules/**`, `src/item/**`, `src/ai/**`, `src/settings/**`,
  `src/content/**`, `src/replay/**`, `src/persistence/**`, `src/scenes/**`,
  `src/server/**`, browser assets, and game adapters.
- `src/physics/defaultPhysics.ts`: although the algorithms are reusable in
  principle, this implementation currently imports KORE-shaped friction
  settings and the KORE entity manager. It is not physically extractable
  without another boundary change and is therefore excluded rather than
  misclassified as Bean.
- `src/engine/runtimeLog.ts`, `startupTelemetry.ts`, `Handler.ts`,
  `types.ts`, `RenderContext.ts`, `drawingEngine.ts`, and `runtimeFactory.ts`:
  these were moved to `src/kore/runtime/**` before the extraction-ready tag.

## Ambiguous ownership decisions

- **Physics contract vs physics implementation:** `physics.ts` contains
  renderer/game-independent vectors, shapes, body validation, contact state,
  and strategy contracts, so it belongs in Bean. `defaultPhysics.ts` is not
  included until its EntityManager/settings dependencies are replaced by
  generic collection/settings contracts; excluding it avoids a hidden KORE
  dependency.
- **Generic effect capabilities:** Roast owns declarative effect metadata and
  capability contracts. Concrete `MetaEffect` classes and KORE item lowering
  remain game-side. The extracted package never executes KORE effects.
- **Entity state:** Roast owns detached transform/movement/counter/numeric
  state records. KORE `PlayerSettings` and `Player` remain outside Crema in
  this first extraction because no generic player abstraction was validated.
- **UI rendering:** Drip owns renderer-neutral UI runtime behavior. p5,
  KORE menu/HUD vocabulary, language catalogs, assets, and browser surfaces
  remain consumers.
- **Replay:** no replay package is extracted in this first cut. KORE replay
  is an application adapter over KORE snapshots and action semantics; the
  generic snapshot/action contracts used by future replay work are already
  in Roast.

## Dependency rule

```text
Roast
Bean  -> Roast
Drip  -> Roast
Crema -> Roast, Bean, and optionally Drip
KORE  -> published packages / public exports
```

No extracted package may import `src/kore/**`, KORE content, game entities,
items, maps, rules, or browser adapters. History and documentation references
are not runtime dependencies.
