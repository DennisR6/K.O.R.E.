# Milestone 31: Migration UI Scenes And Gameplay Surfaces

## Existing Scope

The main menu and gameplay HUD already use KORE UI SDK compositions and
renderer/input adapters. The replay viewer still assembled its browser controls
directly in `main.ts`; the operator dashboard is server-owned HTML.

## Implementation Record

Status: completed.

This milestone first moves replay controls into a validated KORE UI composition
and keeps browser DOM creation inside a dedicated platform adapter.

`createReplayViewerComposition()` now owns the replay title, token input, load
and clipboard commands, and status projection. `createReplayViewerControls()`
is the only browser DOM adapter for that surface; it dispatches declared UI
actions through `UiRuntime` and exposes no gameplay hitboxes. `main.ts` retains
only replay loading/network behavior. The operator dashboard and login remain
server-rendered HTML because they are authenticated server/platform adapters,
not browser gameplay surfaces; their route/security contracts are unchanged.

## Verification

- `npx tsc --noEmit`
- `bun test tests/kore_replay_viewer.test.ts tests/replay_viewer.test.ts tests/replay_urls.test.ts tests/kore_main_menu_composition.test.ts tests/kore_game_hud.test.ts tests/ui_sdk.test.ts tests/ui_sdk_containers.test.ts` (25 passing)
- `bun run test:fast` (698 passing, 3 skipped, 10 known documentation/packaging baseline failures; handled separately by another agent).
