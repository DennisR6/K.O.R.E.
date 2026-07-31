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
