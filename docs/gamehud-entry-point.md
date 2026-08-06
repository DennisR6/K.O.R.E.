# KORE gameplay HUD entry point

`src/kore/ui/gameHud.ts` is the authoritative SDK-authored HUD composition.
`createGameHudComposition().build()` produces serializable UI/audio settings;
the gameplay projection is applied later and is not stored as browser state.

`src/kore/ui/KoreGameHudSurface.ts` adapts that composition to gameplay. It
accepts immutable projections, updates text, visibility, and actions through
the generic `UiRuntime` mutation API, forwards pointer input, and parses
commands through `hudCommands.ts` before invoking the command port. It also
owns HUD audio and optional gameplay-input fallback.

The generic SDK remains unaware of KORE command IDs, teams, rules, or render
contexts. KORE vocabulary and capability limits are enforced at this adapter
boundary.
