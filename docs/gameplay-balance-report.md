# Gameplay Balance Report

## Section 15.5 Match Length And Pacing

The qualification harness measures deterministic engine work, not wall-clock
time. Each match records turns, accepted actions, simulated physics frames, and
`engineWork` (`simulatedFrames + acceptedActions`). Percentiles use nearest rank
so small deterministic samples remain reproducible.

### Mode Thresholds

`qualifiesMatchLengthDistribution` enforces mode-specific thresholds:

| Mode | Minimum turns | Maximum p95 turns | Maximum turn-limit rate | Maximum instant-death rate |
| --- | ---: | ---: | ---: | ---: |
| `local-ice-duel-v1` | 2 | 50 | 10% | 25% |
| `current-turn` | 2 | 100 | 5% | 25% |

An instant death is a terminal match after one accepted action. A turn-limit
match is an ongoing match stopped at the configured safety limit. Draws count
only when the engine reports an explicit draw result.

### Deterministic Smoke Evidence

Command: `bun run test:gameplay-pacing`

The focused test runs 10 seeded `current-turn` matches with a deterministic
hazard-seeking qualification policy and a 20-turn safety limit, then repeats
the same suite. Both runs produce:

| Metric | Result |
| --- | ---: |
| Matches | 10 |
| Minimum / median / p90 / p95 / maximum turns | 3 / 7 / 11 / 11 / 11 |
| Accepted actions | 70 |
| Simulated frames | 3,030 |
| Engine work units | 3,100 |
| Draw rate | 0% |
| Instant-death rate | 0% |
| Turn-limit rate | 0% |

**Status: PASS for deterministic pacing qualification.** Every sample reaches
an explicit winner within the mode threshold. The fixture uses the same
authoritative engine, physics-only rule phase, containment, and lethal-circle
contract as the qualified arena family; its policy deliberately drives team 0
toward a seeded hazard so match duration is measured rather than confused with
AI competence.

**Limitation:** the previous stock hard-AI sample remains a separate finding:
hard AI optimizes opponent contact but does not currently target lethal hazards,
so it can reach the safety limit indefinitely on this arena. That limitation is
not hidden by this pacing qualification and remains relevant to later AI/agency
work. The pacing harness still fails any fixture that actually reaches its
turn limit.

## Section 15.6 Spawn And Team Fairness

Command: `bun run test:gameplay-tournament`

The deterministic smoke tournament runs 8 seeds in each of three variants:
original placement, swapped spawn sides, and swapped first turn. It records
winner distributions by physical side and team index. Fairness imbalance and
safety-limit findings are warnings for human review, not hard release failures.

The test also requires every seeded run to complete without an invariant or
playback violation and requires a byte-for-byte repeat of the same tournament.

### Deterministic Smoke Output

| Variant | Matches | Left wins | Right wins | Team 0 wins | Team 1 wins | Draws | Ongoing warnings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Original | 8 | 0 | 0 | 0 | 0 | 0 | 8 |
| Swapped sides | 8 | 0 | 0 | 0 | 0 | 0 | 8 |
| Swapped first turn | 8 | 0 | 0 | 0 | 0 | 0 | 8 |

The current hard-AI arena does not complete these fairness samples within its
40-turn bound, so no spawn-side or team-index winner imbalance is inferred.
The ongoing result is retained as a warning for the softlock and agency tasks.

## Section 15.7 Meaningful Player Agency

`tests/player_agency_validation.test.ts` analyzes accepted `TurnPacket` results
and action traces rather than counting legal inputs alone. It records legal
actors, distinct action ranges, state changes, opponent interaction, hazard
interaction, and action diversity. The deterministic healthy trace has no
agency warnings and is repeatable.

The required negative traces cover unreachable opponents, one repeated action,
no-op actions, absent hazard interaction, and death before a player acts.
These are warnings for balance or human review, not hard release failures.
Malformed action results, such as an actor mismatch or invalid playback
duration, remain hard failures because they invalidate the evidence itself.
This focused harness is evidence for the agency contract, not a claim that
every shipped configuration has already passed it.

## Section 15.8 Item Usefulness And Item Economy

Command: `bun test tests/item_gameplay_qualification.test.ts`

The deterministic item harness runs 36 cases: all 12 official items in fixed-
loadout, map-pickup, and seeded-draw economies. It checks availability, legal
target rejection, actual consumption, per-turn limits, replay continuity, and
snapshot continuity. The repeated run is byte-for-byte identical.

| Metric | Result |
| --- | ---: |
| Item/economy cases | 33 |
| Availability | 100% |
| Legal-use rate | 100% |
| Actual-use rate | 100% |
| Successful declarative-effect rate | 100% |
| Replay continuity | 100% |
| Snapshot continuity | 100% |
| Winner correlation | unavailable; no terminal match in the item trace |

**Status: TECHNICALLY PASSING; PRODUCTION HUMAN MATCH EVIDENCE RECOVERED.** Invalid
targets are rejected, the one-use-per-turn allowance is enforced, and the
qualification probe observes persistent target, structure, schedule, and
Mystery Box reward state across all official items and three economies.
Production records also show item-use actions in completed human-vs-AI matches.
Questionnaire ratings and observer notes were not persisted, so subjective item
clarity and balance remain explicitly unscored.

## Section 15.12 Final Gameplay Release Decision

The automated evidence is recorded without promoting warnings or incomplete
features to qualification claims. Completed human-controlled production matches
are documented in `docs/playtest-results/production-human-session-2026-08.md`.
The final gameplay release candidate remains **BLOCKED / NOT QUALIFIED** because
AI termination/agency, item qualification, and persisted qualitative
questionnaire evidence remain incomplete.

| Gate area | Evidence and result |
| --- | --- |
| Matrix qualification | 1,152 deterministic configurations executed; the canonical selectable Ice Duel is qualified, while source-present maps, blocked mode/AI/economy combinations remain blocked from selection. |
| Softlock detection | Focused deterministic fixtures pass; fairness samples still produce ongoing safety-limit warnings and are not promoted to completed-match evidence. |
| Pacing | 10 deterministic hazard-seeking matches pass: 3 / 7 / 11 / 11 / 11 turns, 0% draws, 0% instant deaths, 0% turn-limit matches. |
| Spawn-side fairness | 24 mirrored tournament matches are deterministic with no invariant violations; all 24 are ongoing at the current hard-AI safety limit, so no winner imbalance is inferred. |
| Meaningful agency | Healthy trace passes; matrix-wide agency remains open and negative traces remain human-review warnings. |
| Item usefulness/economy | 33 cases pass availability, legal use, consumption, replay, and snapshot continuity; all 11 items report `effect-disappears-after-use`, with winner correlation unavailable. |
| Vertical-slice E2E | Local menu-to-result lifecycle coverage passes in `tests/local_match_lifecycle.integration.test.ts`; browser/packaged human completion is not claimed without a human session. |
| Packaged build | Linux x86_64 Tauri executable and Debian bundle are covered by Section 14.12 evidence and `tests/playtest_build_gate.test.ts`. Windows, macOS, and mobile remain unsupported or unverified. |
| Human sessions completed | 7 unique completed human-vs-AI production records documented in `docs/playtest-results/production-human-session-2026-08.md`; qualitative questionnaire data was not persisted. |
| Human blockers reported | None represented in the recovered production match records; qualitative observations were not persisted. |
| Human blockers fixed | 0; no human defect was fabricated or classified as fixed. |
| Remaining usability concerns | Unassessed until the two-match protocol is completed; only mouse-drag Linux/browser and Linux Tauri paths are in the qualified release surface. |
| Known balance limitations | Hard AI may fail to seek lethal hazards; item effects do not currently persist into gameplay; blocked configurations have no release qualification. |

The Section 15 command record is authoritative for this decision: the full
suite passed with 625 pass / 5 skip / 0 fail, physics fuzz RC passed 5,000
seeded cases, the matrix passed 1,152 cases, and the tournament passed 24
mirrored matches. The 1,000-match AI fuzz RC command timed out after 600
seconds and is therefore not qualified. This does not change the separate
human-evidence blocker.

The gate test is `tests/gameplay_release_gate.test.ts`. It verifies the report,
the complete command list, all Section 15 evidence files, the tournament and
matrix scripts, and this explicit blocked boundary.
