# Milestone 32: Migration Input, Commands, And Actions

## Existing Scope

Shot validation, item target validation, menu/HUD command vocabularies, and
keyboard/controller/touch adapters already exist. Their binding and semantic
command contracts were still split between legacy input modules and KORE UI.

## Implementation Record

Status: completed.

The missing boundary is a KORE-owned, JSON-safe input profile and command
validator that legacy platform adapters can consume without mutating engine
state directly.

`src/kore/sdk/input.ts` now owns the stable action/binding vocabulary and
validated pointer, action, item-use, and menu command contracts. The legacy
`ActionManager` consumes the SDK default profile, while `TouchInputHandler`
routes pointer lifecycle events through `UiSystem.dispatchInput()` and its
validated command boundary. Existing HUD/menu commands and authoritative input
and target validation remain the final mutation boundaries.

## Verification

- `npx tsc --noEmit`
- `bun test tests/kore_input_sdk.test.ts tests/controller_input.test.ts tests/touch_input.test.ts tests/ui_input.test.ts tests/input_directions.test.ts tests/input_fuzz.test.ts tests/item_emitter.test.ts tests/engine_emitter.test.ts` (20 passing)
- `bun run test:fast` (expected documentation/packaging baseline failures are tracked separately).
