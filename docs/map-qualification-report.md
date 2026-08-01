# Map Qualification Report

Section 17 record of every shipped and candidate map's qualification status,
evidence, and known limitations. The design contract is
`docs/map-design-contract.md`; the authoritative machine-readable index is
`src/content/mapCatalog.ts`; the final evidence gate is Task 17.10.

## Status Ledger

Classification values are defined by the map design contract:
`candidate`, `technically-qualified`, `browser-qualified`, `human-qualified`,
`blocked`, `rejected`.

| Map ID | Name | Source | Schema | Dimensions | Symmetry | Spawns | Structures | Hazards | Friction | Drift | Team layouts | Browser | Status | Known limitations |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ice-map-v1 | Ice Map | `src/settings/iceMap.ts` (template) + `src/settings/canonicalPlayableMatch.ts` | template | 800x450 | symmetric | 2 | 7 | 6 deadly-obstacle-circles | ice | 0 | 2 teams, 1/2/6 figures | yes (shipped local match) | candidate | Section 17 evidence pending 17.3/17.7; deadly circles at corners and top/bottom center; some kill corridors narrow (Section 16.4) |
| cue-clash | Cue Clash | `src/settings/cueClashMap.ts` | 1 | scalable (800x450) | symmetric | 2 | 7 | none | billiards | 0 | 2 teams, 1/2/6 figures | no | candidate | blocked-from-selection in content registry; terminal pressure via containment/obstacle elimination only |
| frostbite-arena | Frostbite Arena | `src/settings/frostbiteArenaMap.ts` | 1 | scalable (800x450) | symmetric | 2 | 7 | none | ice | 1 | 2 teams, 1/2/6 figures | no | candidate | blocked-from-selection; forced drift blend 1.0; extreme low friction |
| magma-cradle | Magma Cradle | `src/settings/magmaCradleMap.ts` | 1 | scalable (800x450) | symmetric | 2 | 7 | 2 force-vents, 2 kill-zones | tiles | 0 | 2 teams, 1/2/6 figures | no | candidate | blocked-from-selection; stock hard AI may not seek lethal hazards (17.6 policy note) |
| symmetric-duel | Symmetric Duel | `src/settings/symmetricDuelMap.ts` (planned, Task 17.4) | 1 | scalable | symmetric | 2 | pending | none | ice | 0 | 2 teams, 1 figure | no | candidate | planned Section 17 candidate; created and verified by Task 17.4 |
| structure-control | Structure Control | `src/settings/structureControlMap.ts` (planned, Task 17.5) | 1 | scalable | symmetric | 2 | pending | none | billiards | 0 | 2 teams, 1 figure | no | candidate | planned Section 17 candidate; created and verified by Task 17.5 |
| hazard-control | Hazard Control | `src/settings/hazardControlMap.ts` (planned, Task 17.6) | 1 | scalable | symmetric | 2 | pending | 2 kill-zones | tiles | 0 | 2 teams, 1 figure | no | candidate | planned Section 17 candidate; created and verified by Task 17.6 |

No map receives `technically-qualified` or higher before the Task 17.3
qualification harness and the Task 17.7 matrix evidence are recorded here.
Human qualification remains `PENDING` until external playtest evidence exists
(Task 17.9). No map is promoted from its current content-registry status by
inventory work alone.

## Evidence Record

- 17.1: design contract defined (`docs/map-design-contract.md`), status ledger
  opened with every known map as `candidate`.
- 17.2: authoritative inventory added as `src/content/mapCatalog.ts`
  (7 entries: 4 shipped, 3 planned Section 17 candidates) with every required
  field (stable map ID, display name, source file, schema version, dimensions,
  symmetry, spawn region count, structure count, hazard count/types,
  friction preset, drift, supported team layouts, browser availability,
  qualification status, known limitations) and a validated loader
  `buildMapSettings()` reaching every shipped map through
  `loadMapDocument()`/`validateGameSettings()`. Planned candidates are
  explicitly marked and reject loading until their task creates them.
  `tests/map_content_inventory.test.ts` verifies the negative cases (duplicate
  IDs, missing source files, unreachable source data, unknown IDs, and
  documentation claiming qualification without committed evidence).
