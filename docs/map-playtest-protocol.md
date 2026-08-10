# Map Playtest Protocol

This packet is the human half of Section 17 map qualification (Task 17.9). It
lets external testers compare the qualified map candidates without repository
access or developer explanation. It measures per-map experience, not engine
determinism; the deterministic half is the Task 17.7 matrix, and the
real-browser half is the Task 17.8 E2E evidence. The global two-match human
session stays the Section 15 protocol (`docs/playtest-protocol.md`); the
Section 15 questionnaire (`docs/playtest-questionnaire.md`) remains the
shared rating form, extended here with map-specific items.

## Scope

The candidates are the six maps selectable in the production menu
(`browser-qualified` in the Task 17.8 ledger):

| Map ID | Name | Friction | Hazard character |
| --- | --- | --- | --- |
| ice-map-v1 | Ice Map | ice | deadly circles at corners and top/bottom center |
| cue-clash | Cue Clash | billiards | none; elimination only via containment/obstacles |
| magma-cradle | Magma Cradle | tiles | 2 force-vents, 6 kill-zones including four corner zones |
| symmetric-duel | Symmetric Duel | ice | none; arena walls are the kill boundary |
| structure-control | Structure Control | billiards | none; walls are the kill boundary, central blocker |
| hazard-control | Hazard Control | tiles | 2 mirrored kill-zones guarding the center corridor |

frostbite-arena is `blocked` and not part of this packet.

The ratings below are evidence targets for Task 17.10 and later human
qualification; they are not an assertion that any map has passed them. No
automated test may manufacture a human rating.

## Before The Session

1. Verify the exact build or deployed browser revision. For a local build,
   run `bun run build` followed by `bun run start` from the exact source
   commit, and record `git rev-parse HEAD` together with the bundle timestamp
   or server URL. For a deployed build, record the URL and the deployment
   revision shown on the launch page or reported by the server. Do not mix
   revisions in one session.
2. Record the session metadata block below: non-identifying session ID,
   revision, server URL or artifact path, platform, browser and version,
   display size, observer, and the rotation offset used.
3. Randomize or rotate map order between testers. Use the fixed candidate
   order above rotated by `hash(session_id) mod 6` (any stable hash), or
   simply alternate a literal rotation (1..6) across consecutive session IDs.
   Record the order actually used; never let every tester play the maps in
   the same order.
4. The observer may explain only how to reach the map menu: open the page,
   click **Play Local Game**, then **Choose Map**, then the map row. Do not
   explain any map's hazards, routes, or strategy before the tester plays it.

## Session Procedure

Run one match per selected map, for each map in the rotated order:

1. Ask the tester to pick the next map from the visible **Choose Map** page.
   Record the map ID they chose and the menu route used (landing page ->
   Play Local Game -> Choose Map -> row).
2. During the match, record the first confusion and the first meaningful strategy as verbatim observations with timestamps: what the tester
   expected, what they tried, and what the game showed. The first meaningful
   strategy is the first deliberate, non-random plan (for example "push them
   into the red zone", "bank off the wall", "keep my puck out of the middle").3. Do not intervene unless the session would otherwise stop. If you help,
   log the exact instruction given and which map and turn it concerned.
4. After each match (or once per map in immediate succession), collect the
   per-map evidence: map ID, seed (the match settings seed; the default local
   seed is `12345`, record it when not changed), screenshot, browser console
   log, `window.game.logs` export, and any issue references.
5. Ask the map-specific ratings from the questionnaire immediately, before
   discussing the map with the tester. Record verbatim quotes, not summaries.
6. Classify every finding with a severity (below). A blocker includes a
   crash, an unreachable menu row, an unreadable arena, or a required action
   the tester cannot discover without help.

## Per-Map Ratings

Use the Section 15 scale: `1` strongly disagree to `5` strongly agree. Record
a rating and a short quote or observation for every criterion.

| Criterion | Prompt | Suggested qualification signal |
| --- | --- | --- |
| Readability | "I could read the arena: figures, structures, and the play field were clearly visible." | Median >= 4; no tester unable to identify their figure |
| Navigation | "I could tell where I was, where the edges were, and where my figure could move." | Median >= 4; no tester reporting a hidden or lost figure |
| Hazard clarity | "The dangerous areas and their behavior were clear without explanation." | Median >= 4; no tester entering a hazard unaware |
| Agency | "My actions had a visible, understandable effect on the match." | Median >= 4; no tester reporting an action with no visible effect |
| Pacing | "The match length and waiting felt appropriate for this map." | Median >= 3; record exact too-short/too-long observations |
| Fairness | "Both sides had a fair, understandable chance on this map." | Median >= 3; every unavoidable-loss report is reviewed |
| Willingness to replay | "I would voluntarily play another match on this map." | Median >= 3; record yes/no and reasons, not just the score |

## Evidence And Reproduction

Every session record must include, per map:

- map ID (stable catalog ID, not the display name)
- seed (settings seed; default `12345`)
- screenshot (one per confusion or notable event; at least one per map)
- log evidence (browser console errors and `window.game.logs`)
- blocker severity for every classified finding

Findings are classified as `blocker`, `usability defect`, `balance concern`,
`preference`, or `unsupported request` (Section 15 vocabulary), each with a
severity of `critical`, `major`, or `minor`. File them with the map-specific
template `.github/ISSUE_TEMPLATE/map-playtest-finding.md`.

Mechanical, reproducible findings are handed to the deterministic half: an
observer or developer reproduces the action sequence through the
`bun run test:maps` fixtures or the Task 17.8 browser harness and records the
matching seed. Subjective preferences are never converted into regression
tests or invariants.

## Status Rules

- Human evidence remains `PENDING` until a real external session is
  completed. This packet only makes the session runnable and comparable; it
  does not claim any rating, quote, or finding.
- Automated tests may qualify readiness (the packet exists, is complete, and
  cannot fabricate ratings) but must never manufacture human ratings.
- Map-level human qualification is separate from the existing Section 15
  gameplay release blockers: a map finding does not change the Section 15
  release record, and Section 15 blockers do not by themselves qualify or
  disqualify a map. Task 17.10 gates shipped content on the recorded map
  evidence only.
