# Generic Audio SDK Architecture

## 1. Purpose

KORE can have many independent producers of sound intent (menus, UI runtimes,
gameplay emitters, overlays, and editor tools), but a browser application has
one effective media device/context. The Audio SDK makes producers emit
serializable semantic commands and has an explicit application mixer produce
one deterministic output batch for a single browser adapter.

## 2. Layer model

```text
Engine SDK → Generic Audio SDK → KORE audio definitions → BrowserAudioOutput
                                                       → AudioManager/media APIs
```

`src/engine/audio-sdk/` imports only the generic Engine SDK/contracts. It has
no KORE, UI, browser, DOM, `AudioContext`, `HTMLAudioElement`, or callback
dependency. The Engine SDK does not import the Audio SDK. `src/kore/audio.ts`
owns KORE IDs, bus presets, and optional asset mappings. `src/audio/` and
`src/menu/AudioManager.ts` are browser-only output code.

## 3. Responsibility audit

| Existing symbol or behavior | Current location | Generic Audio SDK responsibility | KORE audio responsibility | Browser adapter responsibility | Migration strategy / compatibility risk |
| --- | --- | --- | --- | --- | --- |
| Playlist and `HTMLAudioElement` ownership | `src/menu/AudioManager.ts` | Output port only | Defines semantic IDs and optional manifest | Creates, pauses, loops, volumes, unlocks, disposes elements | Retains keyboard playlist methods; optional ignored MP3 pack remains a deployment limitation. |
| Global click autoplay handling | `src/main.ts` | No DOM listeners | None | `AudioManager.unlock()` policy | Host now unlocks the one manager; no menu/game object receives browser APIs. |
| Menu page callbacks | `src/menu/Menu.ts` | `ISoundEmitter`, command queue | Menu music and confirm mapping | Applies aggregate batch | `MainMenu` is the UI pilot; immediate scene changes are relayed by `LocalMatchSceneRouter`. |
| Local accepted shot/playback | `src/emitter/EngineEmitter.ts` | Semantic emitter queue | `kore.game.shot` mapping | Plays or drops by lock policy | Plays only after accepted local playback begins, never inside simulation. Network/collision cues remain later work. |
| Physics collision callbacks | `PhysicsSystem`, effects | None yet | Future collision mapping | Future rate-limit/playback | Not migrated: simulation/server/CCD paths must not produce browser media directly. |
| Engine/UI SDK runtime contracts | `src/engine/sdk`, `src/engine/ui-sdk` | Reuses generic registry and explicit lifecycle | May consume outputs | Host drives tick/flush | No circular UI/Audio dependency. |

## 4. Capability model

The generic narrow contracts are `ISoundSource`, `ISoundEmitter`,
`IAudioPosition`, `IAudioVelocity`, `IAudioListener`, and `IAudioPriority`.
`SoundSystem` uses only the structural `ISoundEmitter` capability and skips all
other values. No system checks `instanceof Player`, `Button`, or wall types.

## 5. Command model

Commands are JSON-safe discriminated records: `playSound`, `startLoop`,
`playMusic`, `stopSource`, `stopInstance`, `stopMusic`, `pauseBus`,
`resumeBus`, `setBusVolume`, and `stopAll`. They use semantic `soundId`, local
`sourceId`, optional instance/dedupe IDs, bus, volume, pitch, pan, fade,
priority, and a music replacement policy. Browser URLs and media handles never
enter these contracts.

## 6. Aggregation and determinism

`SoundSystem.tick(emitters)` is explicit and drains compatible emitters sorted
by `soundSourceId`. It validates commands, applies local runtime namespaces,
deduplicates same-source one-shots with an explicit `dedupeKey`, admits voices
by priority and stable ID tie-breaks, updates persistent intent, and exposes a
single batch only through `drainOutput()`.

Pipeline order is deterministic: (1) global/bus controls, (2) source stops,
(3) music, (4) loops, then (5) one-shots. Within a class, higher priority wins;
ties use bus, source ID, sound ID, then collection ordinal. Bus voice limits
are per emitted batch. Repeated one-shots are consumed by a drain and are not
snapshotted or replayed.

## 7. Music ownership

`ApplicationAudioMixer` is the one authoritative music slot. It merges batches
from any number of runtimes, namespaces sources as `runtimeId:sourceId`, and
selects music by priority then stable global source ID. `replace-current`,
`replace-lower-or-equal`, and `keep-current` are evaluated against its active
music intent; command arrival order is not a tie-breaker. KORE menu music has
priority 10 and match music priority 20, so a match replaces the menu.

## 8. Multiple runtime integration

```ts
menuRuntime.tick([menu]);
gameRuntime.tick([gameEmitter]);
mixer.submit(menuRuntime.drainOutput());
mixer.submit(gameRuntime.drainOutput());
browserOutput.apply(mixer.flush());
```

Runtimes remain independent. The application mixer is the only cross-runtime
state owner and can feed one `AudioOutputPort`. The browser host currently uses
one KORE runtime/mixer and structurally collects the active mouse handler and
input emitters each render frame.

## 9. Browser adapter and autoplay

`BrowserAudioOutput` adapts `AudioOutputPort` to `AudioManager`.
`AudioManager` owns media element creation, asset resolution, looping, volume,
pause/resume, failure state, and disposal. It starts locked. While locked it
coalesces persistent music/loop requests, preserves bus controls, and drops
transient one-shots. `unlock()` is called by the browser host after interaction
and replays only retained persistent intent. The generic SDK never registers a
listener or creates browser resources.

## 10. Serialization

`AudioRuntime.toSettings()` preserves buses, persistent loops/music, framework
metadata, and sequence. It excludes consumed transient commands and all browser
objects. Reconstruction is silent until `restorePersistentIntent()` is
explicitly called. `ApplicationAudioMixer.toSettings()` preserves buses and
active music intent. Generic settings never contain asset paths.

## 11. Asset resolution

KORE maps semantic IDs in `KORE_AUDIO_ASSETS`; the browser media owner resolves
those IDs to optional files. The generic contracts use only `soundId`. The
currently ignored MP3 music pack is intentionally a browser deployment concern,
not a game snapshot or SDK requirement.

## 12. KORE boundary and pilots

`koreAudio` provides `kore.music.menu`, `kore.music.match`,
`kore.ui.confirm`, and `kore.game.shot`, with KORE bus defaults. The pilots are:

1. `MainMenu` emits menu music and UI confirmation commands.
2. `GameEmitter` emits match music at live construction.
3. `GameEmitter.sendShot()` emits a shot command only after a validated local
   turn has started visual playback.

These are mappings to semantic cues, not direct `AudioManager` calls.

## 13. Lifecycle and framework

The Audio SDK creates `audio.collect` then `audio.mix` through the existing
`EngineSystemRegistry`; serialized framework metadata is validated by that same
registry. Neither `AudioRuntime` nor `ApplicationAudioMixer` owns a timer,
listener, animation frame, or output call. Hosts explicitly tick, drain,
submit, flush, and apply.

## 14. Determinism

Collection order is source-ID sorted; command normalization has no timer or
device state; priority ties have stable source/sound/ordinal breaks; global
music has stable priority/source selection; and a consumed output drain cannot
replay transient commands. Browser playback is deliberately outside this
deterministic simulation boundary.

## 15. Testing

`tests/audio_sdk.test.ts` covers validation, JSON roundtrip, transient drain,
unsupported-value skipping, deterministic collection, dedupe, bus limits, and
multi-runtime music ownership. `tests/browser_audio_output.test.ts` verifies
the browser adapter with fake media. `tests/kore_audio_pilots.test.ts` covers
menu/game semantic pilots. `tests/browser/browser_audio.e2e.test.ts` verifies
the real browser host submits menu, UI, match, and shot commands.

## 16. Extension model

Other games define their own IDs, asset manifests, buses, and event mappings in
their composition layer, then use the generic emitter/runtime/mixer/output-port
contracts. Dedicated SFX assets, collision mapping, `AudioContext` gain/panner
nodes, crossfades, and network-authoritative cue bridges can be added to a
browser/KORE adapter without changing generic persistent settings.
