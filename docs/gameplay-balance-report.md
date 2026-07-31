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

The deterministic item harness runs 33 cases: all 11 official items in fixed-
loadout, map-pickup, and seeded-draw economies. It checks availability, legal
target rejection, actual consumption, per-turn limits, replay continuity, and
snapshot continuity. The repeated run is byte-for-byte identical.

| Metric | Result |
| --- | ---: |
| Item/economy cases | 33 |
| Availability | 100% |
| Legal-use rate | 100% |
| Actual-use rate | 100% |
| Successful declarative-effect rate | 0% |
| Replay continuity | 100% |
| Snapshot continuity | 100% |
| Winner correlation | unavailable; no terminal match in the item trace |

**Status: INCOMPLETE with deterministic findings.** Invalid targets are
rejected and the one-use-per-turn allowance is enforced, but
`GameHandler.useItem()` currently consumes inventory without installing or
executing the item's declarative effects. The harness therefore emits
`effect-disappears-after-use` for every item. Winner dominance cannot be
qualified until item actions are exercised in terminal matches; this is an
explicit evidence gap, not a passing balance result.
