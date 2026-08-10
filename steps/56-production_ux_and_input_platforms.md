# Milestone 56 — Production UX And Input Platforms

Status: `[-]` in progress

## Delivered in this increment

- Added native touch drag input to the production browser bootstrap.
- Touch input uses the same world-coordinate path and handler contracts as
  mouse input, including HUD/result controls and release outside the canvas.
- Disabled browser touch gestures on the game canvas while a touch action is
  active.
- Added a localized first-turn onboarding hint explaining select, drag, aim,
  and release without changing canonical gameplay state.
- Made failed online connection controls keyboard accessible: Enter retries and
  Escape returns to the menu.

## Remaining work

- Add tutorial/onboarding and clearer action rejection/loading states.
- Complete audio and accessibility review.
- Finish controller mappings and verify touch, mobile, and Steam Deck layouts
  with clean production builds.

## Evidence

- `src/main.ts`
- `tests/touch_input.test.ts`
- `tests/controller_input.test.ts`
- `tests/kore_game_hud.test.ts`
- `tests/status_surface.test.ts`
