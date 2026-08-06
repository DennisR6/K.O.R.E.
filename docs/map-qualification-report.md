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
| ice-map-v1 | Ice Map | `src/settings/iceMap.ts` (template) + `src/settings/canonicalPlayableMatch.ts` | template | 800x450 | symmetric | 2 | 7 | 6 deadly-obstacle-circles | ice | 0 | 2 teams, 1/2/6 figures | yes (shipped local match, menu selectable) | browser-qualified | deadly circles at corners and top/bottom center; some kill corridors narrow (Section 16.4) |
| cue-clash | Cue Clash | `src/settings/cueClashMap.ts` | 1 | scalable (800x450) | symmetric | 2 | 8 (7 solids + 1 containment rect, Task 17.3) | none | billiards | 0 | 2 teams, 1/2/6 figures | yes (menu selectable) | browser-qualified | terminal pressure via containment/obstacle elimination only |
| frostbite-arena | Frostbite Arena | `src/settings/frostbiteArenaMap.ts` | 1 | scalable (800x450) | symmetric | 2 | 8 (7 solids + 1 containment rect, Task 17.3) | none | ice | 1 | 2 teams, 1/2/6 figures | no | blocked | forced drift blend 1.0; extreme low friction; drift 1.0 can wedge two players into the same wall and trigger the Section 13 explicit solver failure (harness evidence 17.3, expected blocked at 17.7) |
| magma-cradle | Magma Cradle | `src/settings/magmaCradleMap.ts` | 1 | scalable (800x450) | symmetric | 2 | 8 (7 solids + 1 containment rect, Task 17.3) | 2 force-vents, 2 kill-zones | tiles | 0 | 2 teams, 1/2/6 figures | yes (menu selectable) | browser-qualified | stock hard AI may not seek lethal hazards (17.6 policy note) |
| symmetric-duel | Symmetric Duel | `src/settings/symmetricDuelMap.ts` | 1 | scalable (800x450) | symmetric | 2 | 2 (1 containment rect + 1 central wall, Task 17.4) | none | ice | 0 | 2 teams, 1 figure | yes (menu selectable) | browser-qualified | kill-ring duel: the arena walls are the containment boundary, so any puck whose full circle leaves the world rect is eliminated; the central wall blocks every straight first-turn line, keeping early elimination reachable only through banked or flanking shots; weak openings (power <= 2) are the safe lane |
| structure-control | Structure Control | `src/settings/structureControlMap.ts` | 1 | scalable (800x450) | symmetric | 2 | 6 (1 containment rect + 4 mirrored columns + 1 central blocker, Task 17.5) | none | billiards | 0 | 2 teams, 1 figure | yes (menu selectable) | browser-qualified | blocker seals the direct spawn corridor so first-turn contact is impossible; arena walls remain the containment kill boundary; the central corridor and top/bottom lanes are the safe advance routes |
| hazard-control | Hazard Control | `src/settings/hazardControlMap.ts` | 1 | scalable (800x450) | symmetric | 2 | 1 (containment rect only) | 2 kill-zone (mirrored center-corridor guards, Task 17.6) | tiles | 0 | 2 teams, 1 figure | yes (menu selectable) | browser-qualified | two mirrored kill zones guard the center corridor between the spawns: every straight crossing is self-eliminating and the opponent is protected behind its own zone; elimination requires driving an opponent into a hazard or its own misplay; the arena walls remain the containment kill boundary |
| aurora-basin | Aurora Basin | `src/content/maps/aurora-basin.ts` | 1 | 800x450 | symmetric | 2 | 3 (containment rect + 2 islands) | none | ice | 0 | 2 teams, 1 figure | yes (menu selectable) | browser-qualified | two central islands shape rebounds; broad north and south lanes preserve alternate approaches |
| lantern-gates | Lantern Gates | `src/content/maps/lantern-gates.ts` | 1 | 800x450 | symmetric | 2 | 4 (containment rect + 3 gates) | none | billiards | 0 | 2 teams, 1 figure | yes (menu selectable) | browser-qualified | the center gate blocks a straight shot but leaves three symmetric lanes |
| ember-crossing | Ember Crossing | `src/content/maps/ember-crossing.ts` | 1 | 800x450 | symmetric | 2 | 1 (containment rect) | 2 kill-zone | tiles | 0 | 2 teams, 1 figure | yes (menu selectable) | browser-qualified | center hazards punish straight crossings; outer lanes remain safe recovery routes |

No map receives `technically-qualified` or higher before the Task 17.3
qualification harness and the Task 17.7 matrix evidence are recorded here,
and no map receives `browser-qualified` before the Task 17.8 real-browser
evidence is recorded. Human qualification remains `PENDING` until external
playtest evidence exists (the Task 17.9 packet is recorded; no external
session has been completed). No map is promoted from its current
content-registry status by inventory work alone.

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
- 17.5: structure-control shipped as `src/settings/structureControlMap.ts`,
  promoted in `src/content/mapCatalog.ts` from planned to a loadable candidate
  (6 structures: 1 containment rect + 4 mirrored columns + 1 central blocker,
  no hazards) and joined the 17.3 qualification matrix.
  `tests/structure_control_map.test.ts` (16 tests) verifies schema
  validation, settings round trip, mirrored spawn geometry (150,225)/(650,225)
  with every structure at least 100 px away, geometric lane widths for all
  three routes (top lane, bottom lane, and both central-corridor gaps are at
  least 2 x radius wide), no single structure partitioning the arena, a full
  360-angle x 10-power sweep proving no legal opening can eliminate the
  opponent on turn 1 (the central blocker seals the direct spawn corridor),
  deterministic line interaction (duplicate corridor taps bit-identical with
  meaningful positional change), deterministic corner interaction (an
  angle-348 power-6 shot grazes the right-top column corner, deflects into
  the bottom-left pocket, and reproduces exactly), bounded multi-contact
  resolution (corner-pocket shots settle within 1200 frames, duplicate runs
  identical), both navigable lanes carrying a puck across the arena alive
  (upper corridor to (787,113), lower corridor to (787,337)), broad action
  margins (corridor taps tolerate +/-3 degrees at power 3), deterministic
  mirrored turns, side-swapped equality with winners at both seeds, and a
  browser-visible initial state through the canonical `FitWorldCamera`.
  Known character: the central blocker seals the direct corridor so
  first-turn contact is impossible; the arena walls remain the containment
  kill boundary, so strong shots into a wall are self-eliminating.
- 17.6: hazard-control shipped as `src/settings/hazardControlMap.ts`,
  promoted in `src/content/mapCatalog.ts` from planned to a loadable candidate
  (1 containment rect, 2 mirrored kill-zone hazards, no solids) and joined the
  17.3 qualification matrix. The map's primary terminal pressure is the
  hazard pair at (300,225) and (500,225) with radius 28: the zones sit
  directly on the line between the spawns, so every straight crossing is
  self-eliminating and the opponent is protected behind its own zone; the
  north and south flank lanes are the non-lethal recovery routes.
  `tests/hazard_control_map.test.ts` (15 tests) verifies schema validation,
  settings round trip, mirrored hazard geometry with spawns at least 60 px
  clear of every zone, an initial-overlap scan with no lethal overlap, a full
  360-angle x 10-power sweep proving no legal opening can eliminate the
  opponent on turn 1 (87 safe openings, zero opponent eliminations),
  deterministic hazard activation (a straight power-6 shot dies inside the
  near zone at a fixed position, duplicate runs bit-identical), a
  hazard-avoidance fixture (both flank lanes cross the arena alive with
  clearance), a hazard-seeking fixture (a legal westbound shot drives the
  defender into the east zone from powers 4-8 and angles 175-185), ordinary
  actions moving pucks toward and away from danger, an explicit winner path
  (a scripted match ends with team 0 winning inside the east kill zone,
  deterministically), deterministic mirrored turns, side-swapped equality
  with winners at both seeds, and snapshot continuity and replay equality
  through the full qualification matrix.   Stock-AI note (17.6 policy): the
  harness Easy AI plays a seeded random walk and terminates the seeded games
  via containment-wall contact; the hazard terminal-path evidence comes from
  the deterministic fixtures above, retained separately as the task requires.
- 17.7: complete shipped-map matrix qualified and recorded. The matrix is a
  resumable, content-addressed cell cache (`tests/support/matrixCache.ts`,
  gitignored `.matrix-cache/`): a cell is keyed by resolved map settings,
  seed, variant, policy, policy limits, qualification limits, cache-schema
  version, and a fingerprint of every engine/physics/rule/AI/harness source;
  records are stored atomically and structurally validated on load, so
  malformed, incomplete, or failed cells are never reused; provenance per
  cell shows cached vs freshly executed. `tests/shipped_map_matrix.test.ts`
  shares one loaded/computed matrix. `bun run test:maps` runs the cache-backed
  dev matrix (12 seeds x 7 maps x 3 variants x 2 policies = 504 cells at full
  depth, smoke seed by default; `MAP_MATRIX_CACHE=0` bypasses the cache) and
  reruns a deterministic representative sample twice fresh to validate
  repeatability and the cache contents without ever comparing cached data
  with itself. `bun run test:maps:matrix` runs two genuinely fresh complete
  executions persisted per attempt (`MAP_MATRIX_ATTEMPT_ID` resumes a failed
  attempt, recomputing only invalidated cells) and compares them byte-for-byte.
  Demonstrated cache behavior: cold run stores 42/42 cells, warm run reuses
  42/42 (41s -> 11s), a map-source change invalidates only that map's 6
  cells, a tampered release cell is detected as a byte-for-byte MISMATCH on
  resume, and truncated/deleted cells are recomputed.
  Full release matrix (attempt `release-2026-08-01`, 504 + 504 fresh cells,
  byte-for-byte MATCH, 0 hard failures): 245 terminal (48.6%), 1 draw (0.2%),
  258 ongoing/turn-limited (51.2%), 118 instant-death (23.4%), turn-limit
  51.2%; turns min 0 / median 3 / p90 24 / p95 24 / max 24; 5,349 accepted
  actions, 1,093,681 simulated frames, 2,189,822 engine ticks; left 145 vs
  right 100 wins, team-0 112 vs team-1 133, opening team 68 vs second team
  177, first-turn wins 118; invariant and replay/restore failures 0 across
  all qualifiable cells. Per map: ice-map-v1 33 terminal / 39 ongoing,
  cue-clash 33/39, magma-cradle 35 terminal + 1 draw / 36 ongoing,
  symmetric-duel 36/36, structure-control 36/36, hazard-control 72 terminal /
  0 ongoing, frostbite-arena 72/72 blocked with the documented Section 13
  evidence. Warning signals recorded (all expected stock-AI character, none
  exposing an invariant or unavoidable elimination): first-turn advantage
  opening 68 vs second 177 (imbalance 0.44, driven by the random-walk easy
  policy self-eliminating its own opening puck), frequent ongoing matches
  0.51 (hard policy rarely terminates within 24 turns on obstacle maps),
  extreme duration outlier (max 24 vs median 3 turns), and policy-dependent
  termination (ongoing easy 0.17 vs hard 0.86). The full-matrix pass also
  caught a harness artifact and fixed it: the post-completion-mutation and
  replay-equality checks now apply to completed matches only, and the
  reference snapshot is taken before any extra verification ticks (an ongoing
  turn-limited run at seed 2107 exposed that ticking a still-playing match
  had been misread as mutation and had shifted the snapshot). Ledger status:
  the six qualifiable maps are `technically-qualified` at that point;
  frostbite-arena is `blocked`; human-qualified remains unclaimed until
  17.9.
- 17.8: real-browser verification of every qualified map
  (`tests/browser/map_catalog.e2e.test.ts`, production menu map-selection
  path). The browser E2E walks the six qualified maps through the production
  UI (landing -> main menu -> "Choose Map" -> map row), verifies the stable
  map ID and finite visible entities, verifies expected structures/hazards
  rendered via canvas pixel probes against the engine-drawn structure colors
  (with open-floor contrast references), advances the item phase through the
  visible panel, performs one real pointer-driven legal action per map
  (deterministic weak opening, power ~1.2), observes bounded playback
  (frames > 0 and <= 1200, then 0 after settle), and returns to the menu
  through a fresh production boot with a clean console. The full-journey
  case (hazard-control) completes menu -> map -> terminal result (team-1
  drives itself into the east kill zone, the broad verified 17.6 route) ->
  rematch -> second terminal match -> menu entirely through pointer input.
  As part of the selection path, `loadMapDocument` now assigns the default
  render color `#315b7d` to uncolored solid geometry (containment stays
  invisible), so document maps are actually visible in the browser; the
  matrix cache cells for document maps were recomputed once after this
  settings-hash change (the recorded release attempt remains valid as
  evidence of its snapshot). Ledger status: the six qualifiable maps are
  `browser-qualified` and selectable in the production menu; frostbite-arena
  is `blocked`; human-qualified remains `PENDING` until 17.9 external
  playtest evidence exists.
- 17.9: map review and human-test readiness recorded. The external-tester
  packet `docs/map-playtest-protocol.md` covers the six browser-qualified
  candidates (frostbite-arena excluded as blocked): exact build or deployed
  browser revision verification, play from the visible "Choose Map" menu
  page, per-tester rotated map order, verbatim first-confusion and
  first-meaningful-strategy recording, the seven per-map ratings
  (readability, navigation, hazard clarity, agency, pacing, fairness,
  willingness to replay), and per-map evidence collection (map ID, settings
  seed, screenshot, console/log export, blocker severity).
  `.github/ISSUE_TEMPLATE/map-playtest-finding.md` is the map-specific issue
  template with severity, map ID, seed, and evidence fields.
  `tests/map_playtest_readiness.test.ts` qualifies the packet's readiness
  without manufacturing human ratings. Human evidence remains `PENDING`
  until a real external session is completed; map-level human qualification
  stays separate from the Section 15 gameplay release blockers and does not change the Section 15 release record.
- 45: the production SDK-authored competitive pack adds `aurora-basin`,
  `lantern-gates`, and `ember-crossing` under `src/content/maps/`. Each uses
  only public `kore.createDefaultMap()` geometry/spawn/hazard APIs, has a stable
  catalog identity, mirrored two-team spawns, and is reachable through the
  approved repository loader. The SDK authoring boundary now derives omitted
  map IDs and generated player IDs deterministically rather than using random
  UUIDs. Focused evidence is in `tests/competitive_map_pack.test.ts`, covering
  document/settings fingerprints, approved repository revisions, and schema,
  spawn, snapshot/restore, replay, and deterministic qualification checks.
  Browser availability is catalog-integrated and browser probes cover all three
  new map geometries; no human fairness or playtest qualification is inferred.
