# Milestone 37: Legacy API Removal And Dependency Enforcement

## Status

Completed on branch `milestone-37-legacy-api-removal`.

## Delivered

- Removed the deprecated compatibility entry `src/kore_sdk.ts`; all remaining
  callers import the canonical `src/kore/sdk/index.ts` export.
- Removed obsolete legacy modules: `src/item/ItemAnker.ts`,
  `src/item/ItemCollector.ts`, `src/item/ItemWall.ts`, `src/item/Items.ts`,
  `src/item/minimalItem.ts`, `src/emitter/ReplayEmitter.ts`,
  `src/emitter/Emitter.ts`, `src/ui/UiStrategy.ts`,
  `src/engine/gameOptions.ts`, `src/settings/billiardMap.ts`,
  `src/settings/test.ts`, `src/server/game.ts`, `src/server/shoot.ts`, and
  `src/server/utils.ts`.
- Kept `src/emitter/ObjectEmitter.ts`; tests still use it as the capture
  emitter, and the removed `Emitter.ts` barrel was the only other consumer.
- Migrated `tests/kore_sdk.test.ts` and
  `tests/engine_sdk_architecture.test.ts` to the canonical SDK import and
  dropped the legacy-entry equality assertion.
- Added `tests/legacy_api_removal.test.ts` guard coverage that locks the
  removed file list, forbids production imports of removed legacy modules,
  confines `GameHandlerBuilder` construction and imports to the
  `src/engine/Handler.ts`/`src/engine/runtimeFactory.ts` runtime boundary, and
  forbids importing the deprecated compatibility entry.
- Updated the SDK migration inventory, `AGENTS.md`, `SDK_ARCHITECTURE.md`, and
  `README.md` to drop the removed modules.

## Evidence

- `tests/legacy_api_removal.test.ts`
- Focused migration/inventory verification passed 14 tests and 600
  assertions.
- Emitter/input/simulation/collision regression passed 24 tests.
- Item/settings/ui/input/kore verification passed 84 tests and 530
  assertions.
- `bun run test:fast` passed 706 tests; the 9 remaining failures are the
  known Section 14/15/20 documentation and packaging baseline gates handled
  separately.
- `bun run build` passed.
- TypeScript verification: `npx tsc --noEmit` passed.
