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
| cue-clash | Cue Clash | `src/settings/cueClashMap.ts` | 1 | scalable (800x450) | symmetric | 2 | 8 (7 solids + 1 containment rect, Task 17.3) | none | billiards | 0 | 2 teams, 1/2/6 figures | no | candidate | blocked-from-selection in content registry; terminal pressure via containment/obstacle elimination only |
| frostbite-arena | Frostbite Arena | `src/settings/frostbiteArenaMap.ts` | 1 | scalable (800x450) | symmetric | 2 | 8 (7 solids + 1 containment rect, Task 17.3) | none | ice | 1 | 2 teams, 1/2/6 figures | no | candidate | blocked-from-selection; forced drift blend 1.0; extreme low friction; drift 1.0 can wedge two players into the same wall and trigger the Section 13 explicit solver failure (harness evidence 17.3, expected blocked at 17.7) |
| magma-cradle | Magma Cradle | `src/settings/magmaCradleMap.ts` | 1 | scalable (800x450) | symmetric | 2 | 8 (7 solids + 1 containment rect, Task 17.3) | 2 force-vents, 2 kill-zones | tiles | 0 | 2 teams, 1/2/6 figures | no | candidate | blocked-from-selection; stock hard AI may not seek lethal hazards (17.6 policy note) |
| symmetric-duel | Symmetric Duel | `src/settings/symmetricDuelMap.ts` | 1 | scalable (800x450) | symmetric | 2 | 2 (1 containment rect + 1 central wall, Task 17.4) | none | ice | 0 | 2 teams, 1 figure | no | candidate | kill-ring duel: the arena walls are the containment boundary, so any puck whose full circle leaves the world rect is eliminated; the central wall blocks every straight first-turn line, keeping early elimination reachable only through banked or flanking shots; weak openings (power <= 2) are the safe lane |
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
- 17.3: deterministic qualification harness added as
  `tests/support/mapQualification.ts` (`qualifyMapSettings()`,
  `qualifyMap()`, `inspectMapSettings()`, `mirrorSettings()`) with the full
  required check set (schema/spawn/containment/first-action/bounded-playback/
  determinism/snapshot-restore/replay/terminal/no-post-completion-mutation),
  the required structured output (map ID, seed, variant, accepted actions,
  turns, simulated frames, engine work, result, safety-limit status, spawn
  and invariant findings, replay/restore status, deterministic fingerprint),
  and honest failure classification (a thrown engine error becomes a
  structured failed run; duplicate runs failing identically remain
  deterministic; a safety-limit result is never converted into an artificial
  draw). The three document maps gained explicit containment rects (first
  `arenaGeometry` element, structure counts 7 -> 8) because they previously
  lacked containment geometry and players left the world. Harness evidence:
  `ice-map-v1`, `cue-clash`, and `magma-cradle` pass the full matrix at seeds
  1503/1504 (winners, bounded, deterministic, replay/restore clean);
  `frostbite-arena` deterministically triggers the Section 13 explicit
  failure "Unresolved penetration after max solver iterations" at both seeds
  (a two-player wall jam under drift 1.0) and is classified as a structured
  blocked result, never an artificial draw. `tests/map_qualification_harness.test.ts`
  (12 tests / 230 assertions) covers the positive matrix, the deterministic
  blocked classification, side-swapped mirroring, and the negative cases
  (malformed data, lethal spawn, dead spawn, playback stall, playback bound
  exposure, custom labels).
- 17.4: symmetric-duel shipped as `src/settings/symmetricDuelMap.ts`, promoted
  in `src/content/mapCatalog.ts` from planned to a loadable candidate (2
  structures: containment rect + central wall, no hazards) and joined the
  17.3 qualification matrix. `tests/symmetric_duel_map.test.ts` (12 tests)
  verifies schema validation, settings round trip, mirrored spawn geometry
  with equal distances (198 px to the central wall, 138 px to the arena walls
  on both sides), a full 360-angle x 10-power sweep proving no legal opening
  can eliminate the opponent on turn 1 (the wall covers the whole corridor
  band), two materially different legal openings, a terminal route that does
  not require pixel-exact input (an off-axis drive sends the defender's puck
  into the outer wall at powers 6-10), no new engine behavior, deterministic
  first turns from both sides (duplicate runs bit-identical; the team-1
  mirrored shot mirrors the team-0 result), side-swapped equality, bounded
  playback with winners at both seeds, and a browser-visible initial state
  through the canonical `FitWorldCamera`. Known character: the arena walls
  double as the containment kill boundary, so strong shots into a wall are
  self-eliminating; the stock easy AI frequently eliminates itself this way,
  which keeps the harness games deterministic but short.
