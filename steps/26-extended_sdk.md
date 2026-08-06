# Step 26: Extended SDK — Nested UI Containers And KORE Menu Integration

- **Status**: `[x]` Completed
- **Merge Commit Hash**: `5912d7c`
- **Implementation Commit Hash**: `1197f9e`

## Summary

Merged the extended SDK implementation with `staging`. The generic UI SDK now
supports JSON-safe recursive containers and deterministic absolute, horizontal,
and vertical layouts with padding, gaps, justification, alignment, nesting,
visibility/enabled inheritance, recursive mutation, shared geometry, and
duplicate-ID validation. Added focused container coverage and architecture
documentation.

The KORE main menu was migrated to a vertical title/actions composition with a
horizontal action container and enum-backed menu vocabulary. Menu and HUD entry
points were documented, affected unit/browser coordinates were updated, and the
existing menu/HUD/browser smoke coverage continues to pass.

## Evidence

- `tests/ui_sdk_containers.test.ts`
- `tests/ui_sdk.test.ts`
- `tests/kore_main_menu_composition.test.ts`
- `tests/kore_game_hud.test.ts`
- `bun run test:browser:menu-sdk`
- `bun run test:browser:smoke`
- `npx tsc --noEmit`
