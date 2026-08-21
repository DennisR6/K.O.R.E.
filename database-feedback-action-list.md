# Database Feedback Action List

Analysis source: downloaded `data/kore.db` (read-only), analyzed 2026-08-21.

## Evidence summary

- 17 user-feedback records; 12 include ratings: 3x rating 3, 7x rating 4, 2x rating 5 (average 3.92).
- 104 offline match records: 38 human-vs-AI, 45 hotseat, 21 AI-vs-AI.
- Map coverage is heavily skewed: Magma Cradle 75/104 matches; Ice Map 13; all other maps 5 or fewer.
- Human-vs-AI results favor the AI 24–14; AI-vs-AI favors team 1 13–8. This is a signal for balance investigation, not proof of unfairness because team/map/seed distributions are uncontrolled.
- Performance reports show median frame time around 17.1 ms and reported p95 frame time at or below 18 ms. Turn median is about 4.8 seconds, with some turns exceeding 13 seconds.
- Several hotseat records end at turn 1 with zero replay actions. These appear to be aborted/test records and should be excluded from balance conclusions.
- No map revisions or structured match reports are present in this database export.

## Implementation status audit

| Finding | Current status | Evidence in source/tests | Remaining work |
|---|---|---|---|
| Inventory refresh after pickup | **Mostly implemented** | `MapPickupSystem` mutates canonical inventory; HUD reprojects every post-tick; pickup and HUD tests exist. | Add a real browser regression proving the visible card updates immediately after collection. Investigate the historical report as a stale-build or scene-refresh regression. |
| Online desync/premature completion | **Partially implemented** | Server owns completion; TURN packets carry state hashes; stale/hash-mismatch logs and diagnostic feedback exist; reconnect and authority tests exist. | A hash mismatch is logged but not repaired in `NetworkEmitter`; add authoritative resync/recovery and a browser reconnect/desync test. |
| Hazard force inconsistency | **Partially implemented** | Force hazards validate degrees and use the shared degree-based impulse path; deterministic hazard tests exist. | Add player-facing direction/strength preview and tests covering collision angle, mass, and map conversion. |
| Item timing and comprehension | **Partially implemented** | Cards show descriptions/target types; item phases, validation, delayed effects, and inventory are tested. | Explain timing/arming/trigger conditions and define post-shot defensive-item windows explicitly. |
| Mobile layout/input | **Partially implemented** | Touch input shares pointer validation; mobile layout tests and native cursor work exist. | Landscape-first behavior, portrait prompt, drag-radius tuning, and real-device/browser evidence remain. |
| Gameplay animation visibility | **Implemented in source, not yet human-qualified** | Deterministic presentation surface, feedback events, focused tests, and browser builds pass. | Verify in a production browser scene and add stronger procedural particles if effects remain too subtle. |
| AI forgiveness/balance | **Partially implemented** | AI fuzz/tournament infrastructure, deterministic difficulty settings, and termination tests exist. | Run controlled human-facing balance experiments; current database results are confounded by map/team/seed selection. |
| Team/map fairness | **Infrastructure exists, evidence incomplete** | Map qualification and mirrored matrix helpers exist. | Exclude aborted fixtures, run balanced team/map tournaments, and publish thresholds. |
| Telemetry quality | **Partially implemented** | Playtest marker, ratings/topics, performance reports, replay/performance persistence, and bug diagnostics exist. | Add explicit aborted/completed status and structured item/hazard/desync counters. |

## Priority 0 — fix before broader playtesting

### 1. Item inventory refresh after pickup

Evidence: `Iteems erscheinen nach Einsammeln nicht sofort in der Item Tasche. Kommen wieder wenn einer meiner Figuren stirbt.`

Implement/verify:

- Refresh the HUD projection immediately after `MapPickupSystem` grants an item.
- Preserve inventory updates across selection changes, playback, death, rematch, and reconnect.
- Add a regression test that collects a pickup and asserts the item card changes in the same frame/turn.

### 2. Online desynchronization and premature match end

Evidence: online bug report says the match ended while both teams still had living players and explicitly reports a desync.

Implement/verify:

- Compare authoritative and client state hashes at every accepted turn and expose a diagnostic packet report.
- Reject or recover from stale/out-of-order snapshots without ending the match locally.
- Add an online integration test for reconnect during playback, duplicate TURN packets, and mismatched final snapshots.
- Make the server authoritative for completion; clients must not infer game-over from partial elimination state.

### 3. Hazard force consistency

Evidence: hazard input sometimes feels strong or weak; tester asks whether the angle affects it.

Implement/verify:

- Display hazard direction and force magnitude in the HUD/debug feedback.
- Confirm coordinate/angle convention and normalize all hazard vectors at the conversion boundary.
- Add deterministic tests for the same hazard at multiple entry angles and for repeated snapshot restores.
- Surface whether force is additive, mass-scaled, or collision-normal-based so the result is understandable.

## Priority 1 — improve player comprehension and control

### 4. Item usability and timing

Evidence: `Items unklar`; delayed mine may not have worked; users want Anchor and Wall to be usable after their shot for the next physics phase.

Implement/verify:

- Show item timing (`this phase`, `next phase`, or `next turn`) on every item card.
- Show target type, range, affected team, duration, and a preview before confirmation.
- Explain delayed mine arming, trigger radius, and detonation condition in-world.
- Define and communicate whether defensive items can be queued after a shot; if supported, add an explicit post-shot item window rather than relying on hidden phase behavior.
- Add item lifecycle tests for delayed mine, Anchor, Mini-Wall, and pickup-to-inventory flow.

### 5. Mobile landscape-first layout and input

Evidence: multiple reports call mobile UI/view poor or janky; one specifically requests landscape; another suggests a larger drag radius.

Implement/verify:

- Prefer landscape on phones, with a clear rotation prompt in portrait mode.
- Increase the minimum drag target while preserving precise aim after the initial selection.
- Add a visible selected-actor marker, drag origin, power scale, and release preview.
- Ensure the camera/world and item panel fit without overlap at common 16:9 and narrow landscape sizes.
- Test touch drag, cancellation, pointer capture, safe-area insets, and low-resolution devices in a real browser.

### 6. Feedback and animation visibility

Evidence: controls were described as smooth in two sessions, but gameplay feedback was not consistently visible during testing.

Implement/verify:

- Keep procedural shot, collision, hazard, damage, pickup, and elimination effects visible for a readable duration.
- Add deterministic particle bursts and directional hazard indicators, not just short rings.
- Add a replay/browser smoke assertion that feedback events reach the presentation surface and are drawn.
- Avoid replacing important world feedback with a top-center text banner only.

## Priority 2 — balance and content

### 7. AI difficulty and forgiveness

Evidence: `KI too strong`; a small mistake or one non-kill round can lead to defeat. Human-vs-AI wins are 14 human / 24 AI in this export.

Implement/verify:

- Re-run controlled tournaments with equal maps, seeds, starting teams, and difficulty.
- Tune Easy for recovery and imperfect aim, Medium for pressure, and Hard for high agency without unavoidable kills.
- Add a grace/recovery metric: survival after a non-kill turn, not only win rate.
- Report kill rate, first-kill advantage, average turn count, and comeback rate by difficulty/map.

### 8. Team and map fairness

Evidence: team 1 wins 36/45 hotseat and 13/21 AI battles; Magma Cradle dominates the sample.

Implement/verify:

- Run mirrored team-start and map-balanced tournaments.
- Check spawn symmetry, hazard orientation, pickup placement, and first-shot geometry.
- Add automated fairness thresholds per map and a human-readable map diagnostics report.
- Do not tune from the current hotseat turn-1 records until aborted/test matches are separated from completed matches.

## Priority 3 — telemetry and release process

### 9. Improve telemetry quality

Implement/verify:

- Add explicit `completed`, `aborted`, and `quit` match status to offline reports.
- Mark automated, browser-smoke, and human-playtest records separately.
- Store structured event counters for item pickup/use, rejected actions, hazard contacts, desyncs, and rematches.
- Add map, mode, seed, team, and difficulty dimensions to aggregate reports without storing unnecessary personal data.
- Preserve bug reports with turn number, client/server hashes, and the relevant replay token.

### 10. Expand playtest coverage

The export has useful feedback but is concentrated on Magma Cradle and human-vs-AI.

- Require sessions across every release map.
- Require both mobile landscape and desktop sessions.
- Require at least one item-focused session and one online reconnect/desync session.
- Keep a short structured questionnaire alongside free text: control clarity, item clarity, hazard clarity, fairness, performance, and enjoyment.

## Recommended implementation order

1. Inventory refresh and item timing/preview.
2. Online authority/desync completion hardening.
3. Hazard vector/force instrumentation and tests.
4. Mobile landscape and drag UX.
5. Procedural gameplay feedback visibility.
6. Controlled AI/map balance tournament.
7. Telemetry status and structured event improvements.
8. Repeat external human sessions and update release qualification.
