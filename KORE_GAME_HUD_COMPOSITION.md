# KORE Game HUD Composition

## Purpose and source

`src/kore/ui/gameHud.ts` is the authoritative declarative HUD definition.
`createGameHudComposition().build()` produces JSON-safe `KoreGameHudSettings`
with the static HUD screen, item slots, phase controls, modal result controls,
styles, UI/audio framework metadata, and enum-backed commands.

`KoreGameHudSurface` reconstructs `UiRuntime`, applies immutable projections,
explicitly ticks/draws, validates generic string commands at the KORE boundary,
and emits semantic UI audio. It has no browser listener, `AudioManager`,
`GameHandler`, or manual pointer-hit-test dependency.

## Projection and ownership

`createKoreHudProjection(handler, uiInput, rejection?)` creates detached data
for turn/team/phase, aim/power, inventory, waiting/lock state, result, and
rejection text. Gameplay remains authoritative for rules, inventory, targets,
result, and rematch. Applying a projection only updates declarative HUD state;
it never mutates gameplay.

The scene/browser host installs the HUD over the world input, projects after
gameplay ticks and before HUD draws, and passes only unconsumed non-modal input
to `UiSystem`. World-space drag aiming remains gameplay input, not a generic UI
feature.

## Commands and typing

Generic UI actions remain string-based at the canonical boundary. KORE
production authoring uses `KoreHudCommand` enum values from
`src/kore/ui/hudCommands.ts`; serialized settings contain their stable strings.
`KoreHudCommandPayloads`, `KoreHudCommandMessage`, and
`parseKoreHudCommand()` provide typed payloads and runtime narrowing.
`hudVocabulary.ts` owns the remaining enum-backed KORE HUD IDs, screen, styles,
labels, and closed item slots. The HUD uses exhaustive command routing;
unknown/malformed commands are rejected and never reach gameplay. Generic UI
continues to use serialized strings and is unchanged.

Current command domains are item use/skip, pause/resume, rematch, replay,
share, and return-to-menu. Item actions propose a self target; `ItemPhaseUI`
and the emitter still validate gameplay authority before consumption.

## Audio, pause, and result

Locally accepted HUD actions emit `kore.ui.confirm` through the HUD
`ISoundEmitter`. Command ports can return `false` for asynchronous requests;
the network port does this so request submission is not mistaken for server
acceptance.
The existing `SoundSystem` → `ApplicationAudioMixer` → `BrowserAudioOutput`
path remains the only browser-audio route. Gameplay shot/music cues remain in
the gameplay emitter. Local HUD pause is host-local and freezes
`GameHandler.tick()` without changing any serializable authoritative state;
resume releases that transient lock. Network pause operations remain the
browser/server-host mutual-pause functionality, so the network HUD hides its
pause/resume controls. The network HUD also hides item skip until an
authoritative skip-phase protocol exists.

Result visibility is projection-driven. Rematch and menu actions are semantic
HUD commands routed by `LocalMatchSceneRouter`; returning to menu releases
match music through the existing scene audio policy.

## Extending

1. Add static elements/styles in `gameHud.ts`.
2. Add projected fields in `gameHudProjection.ts`.
3. Add a `KoreHudCommand` enum member and payload mapping.
4. Add runtime parser validation and exhaustive routing in the surface/host.
5. Add a KORE sound preset if needed; never use URLs or `AudioManager` in HUD
   settings.
6. Add composition, projection, authority, and browser coverage.

## Parity

| Legacy behavior | SDK replacement | Status |
| --- | --- | --- |
| Turn/status/aim feedback | Projection labels | migrated |
| Item panel and skip hitboxes | SDK item buttons/skip command | migrated |
| Result overlay/rematch/menu | SDK modal result controls | migrated |
| Direction/status duplicate layers | HUD projection draws active-player dots and pull-arrow geometry; world renderer no longer draws status/result | migrated |
| World drag aiming | `UiSystem` delegated input | intentionally retained as world input |
| Local pause | HUD command freezes transient local handler ticks | migrated |
| DOM network pause/share/report controls | Browser host; unavailable HUD controls are hidden | intentionally browser-hosted |
