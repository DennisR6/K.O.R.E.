# KORE menu entry point

`src/kore/ui/mainMenu.ts` is the authoritative composition entry point for
the KORE menu. `createMainMenuComposition().build()` returns JSON-safe UI,
audio, and metadata settings without creating a browser loop or owning input.

`src/kore/ui/KoreMainMenuSurface.ts` is the concrete adapter. It supplies
pointer input to `UiRuntime`, renders through the KORE canvas renderer, drains
semantic commands, and routes validated menu vocabulary to application
callbacks. Menu audio is emitted through the audio port.

The main screen demonstrates nested containers: a vertical screen contains the
title and a horizontal `main-actions` container. Button actions remain
declarative (`navigate` or `emit`), so layout changes do not alter routing.
