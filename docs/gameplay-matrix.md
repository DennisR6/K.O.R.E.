# Shipped Gameplay Matrix

This is the Section 15.2 inventory of gameplay content present in the current
source tree. The machine-readable source is
`src/content/gameplayContentRegistry.ts`.

## Statuses

- `qualified`: currently selectable or verified by the existing release and
  vertical-slice evidence.
- `blocked-from-selection`: implemented or declared in source, but no current
  menu or startup path selects it. Section 15.3 must not treat it as qualified.
- `unsupported`: a source abstraction or packaging target exists, but the
  current release path does not provide an end-to-end supported configuration.

## Maps

| ID | Name | Source | Selection | Teams | Figures/team | Hazards | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ice-map-v1` | Ice Map | `src/settings/iceMap.ts` | Canonical local match | 2 | 1, 2, 6 | Deadly obstacle circles | Qualified |
| `cue-clash` | Cue Clash | `src/settings/cueClashMap.ts` | None | 2 | 1, 2, 6 | None | Blocked |
| `frostbite-arena` | Frostbite Arena | `src/settings/frostbiteArenaMap.ts` | None | 2 | 1, 2, 6 | None | Blocked |
| `magma-cradle` | Magma Cradle | `src/settings/magmaCradleMap.ts` | None | 2 | 1, 2, 6 | Force vents, kill zones | Blocked |

All map documents are scalable from the 800x450 blueprint. Only the Ice Map
is connected to the current local menu. The editor prototype is not a shipped
gameplay map and is intentionally not listed here.

## Modes And Counts

| Mode | Phases | Item configuration | AI | Status |
| --- | --- | --- | --- | --- |
| `local-ice-duel-v1` | Item, physics | Fixed `power-dash` loadout | None | Qualified |
| `current-turn` | Physics | Disabled by default | Optional | Blocked |

The canonical selectable match is two teams with one figure per team. The
default Ice Map layout also creates two teams with six figures each, and the
versus-AI factory creates two teams with two figures each. The AI factory
supports `easy`, `medium`, and `hard`, with team 1 controlled by AI; it is not
currently selectable from the menu.

## Items

The official validated catalog contains 11 IDs:

`anker`, `durchlaessigkeit`, `magnet`, `falltuer`, `power-dash`,
`verzoegerte-mine`, `mini-wall`, `freeze-shot`, `switch`,
`jaegermeister-elixier`, and `vodka-zero`.

The only selectable item set is the canonical match's one-use-per-team
`power-dash` fixed loadout. The item system also declares disabled, fixed
loadout, map-pickup, and seeded-draw economy shapes; the latter three are not
currently exposed by the menu.

## Platforms And Controls

| Target | Controls | Status | Evidence/limit |
| --- | --- | --- | --- |
| Browser desktop | Mouse drag | Qualified | Wired by `src/main.ts` |
| Tauri Linux | Mouse drag | Qualified | Linux binary and Debian target |
| Tauri Windows | Mouse drag | Unsupported | Target declared, not verified here |
| Tauri macOS | Mouse drag | Unsupported | Target declared, not verified here |
| Mobile web | Touch drag | Unsupported | Touch abstraction exists, but current startup does not wire it into gameplay |

Keyboard, gamepad, and touch abstractions exist in source, but only mouse drag
is connected to the current browser gameplay startup. `src/input/actions.ts`
contains bindings for aim, charge, push, and item use; these are inventory
entries, not evidence of a selectable end-to-end control configuration.

## Qualification Boundary

Task 15.2 inventories content; it does not execute the full matrix. The
`qualified` entries are the current release surface and existing evidence.
Blocked and unsupported entries remain explicit so Task 15.3 can either
qualify them or keep them unavailable without silently expanding the release
surface.
