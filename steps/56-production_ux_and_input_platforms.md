# Milestone 56 — Production UX And Input Platforms

Status: `[-]` in progress

## Delivered in this increment

- Added native touch drag input to the production browser bootstrap.
- Touch input uses the same world-coordinate path and handler contracts as
  mouse input, including HUD/result controls and release outside the canvas.
- Disabled browser touch gestures on the game canvas while a touch action is
  active.
- Added a localized first-turn onboarding hint explaining select, drag, aim,
  and release without changing canonical gameplay state; it appears only after
  the optional item phase so it does not conflict with item instructions.
- Made failed online connection controls keyboard accessible: Enter retries and
  Escape returns to the menu.
- Added generic UI keyboard focus navigation: Tab/arrows move through visible
  controls and Enter/Space activates the focused control.
- Prevented browser scrolling for UI navigation keys while the production game
  canvas is active, keeping keyboard commands usable on compact screens.
- Added a visible keyboard-focus outline to HUD controls so focused actions are
  distinguishable without relying on hover or color alone.
- Added an opt-in gamepad polling path for connected browsers: the left stick
  aims, the trigger sets power, and the push button releases the shot through
  the existing mouse/input authority boundary. Gamepad release qualification
  remains pending.

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
- `tests/ui_sdk.test.ts`
- `tests/browser/browser_startup.e2e.test.ts` (including keyboard menu navigation)
