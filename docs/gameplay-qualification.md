# Gameplay Qualification Contract

This contract defines what it means for one supported gameplay configuration to
be technically playable. It is the technical half of Section 15. Human
clarity and enjoyment are evaluated separately in
`docs/playtest-protocol.md`.

## Scope

The contract applies to a concrete configuration: map, mode, team and figure
counts, item settings, AI or human slots, seed, platform, and control scheme.
It is evaluated using the authoritative `GameHandler` and the same validated
action path used by the playable vertical slice. A configuration is not
qualified merely because its engine can be constructed.

Section 14's canonical local Ice Duel is the reference witness for this
contract. Sections 15.2 and 15.3 will enumerate and execute the complete
shipped matrix; this document does not claim that matrix is already qualified.

## Technical Criteria

Every criterion below is a pass/fail requirement for each executed
configuration. Evidence must identify the configuration and deterministic
seed.

| Criterion | Measurable pass condition | Required evidence |
| --- | --- | --- |
| Valid spawn | Construction succeeds; every configured actor is alive, finite, inside containment, visible, and not overlapping forbidden geometry at tick 0. | Initial `EngineSettings` snapshot and map validation result |
| Legal first action | At least one active actor has a finite, in-range action accepted by the shared validator; rejection of malformed actions leaves the snapshot unchanged. | Accepted action plus before/after snapshots for a rejected action |
| Advancing rule phases | Every required phase transition is accepted exactly once, reaches the next configured phase, and cannot accept an action from the wrong phase. | Ordered rule-state trace including turn and active team |
| Bounded playback | Each accepted action reaches playback completion within the configured simulation limit of 1,200 frames; the playback lock clears and final state is synchronized. | Action trace with simulated duration and final snapshot |
| No softlock | The match reaches a terminal result before the mode safety limit, with no repeated full progress fingerprint beyond the harness limit and no accepted no-op action loop. | Per-turn progress fingerprints and termination reason |
| Winner or explicit draw | Completion produces `MatchStatus.Winner` with a valid surviving team or `MatchStatus.Draw` with `winnerTeam: null`; no ongoing state is reported as complete. | Terminal `MatchResult` and final handler snapshot |
| Stable replay | Recording accepted actions and replaying them from the same initial settings produces byte-equivalent final engine settings, including rule state and result. | Live/replay final snapshot comparison |
| Stable snapshot restore | Restoring from snapshots at initial state, during movement, and after a completed turn produces the same continuation as uninterrupted execution. | Per-tick or per-action restored/uninterrupted snapshot comparisons |
| No post-completion mutation | Once synchronized completion is reached, ticks and input attempts do not change the final snapshot; only the sanctioned rematch or menu transition may replace it. | Before/after terminal tick and rejected-input snapshots |

### Technical Gate

The configuration passes only when all nine criteria pass. A crash, uncaught
validation error, unresolved match, replay mismatch, restore mismatch, or
post-completion mutation is a technical blocker. A draw is valid only when it
is an explicit terminal result, not an inferred timeout or test abort.

The qualification harness must report at least: configuration identity, seed,
initial snapshot hash, accepted action count, phase trace, maximum playback
frames, terminal status, replay equality, restore equality, and the first
failure's turn and snapshot. Wall-clock duration is diagnostic only and is not
a gameplay pass criterion.

## Evidence Record

Use one record per configuration and seed:

```text
configuration: <map>/<mode>/<teams>x<figures>/<items>/<controls>
seed: <integer>
platform: <target>
spawn: PASS|FAIL
first_action: PASS|FAIL
rule_phases: PASS|FAIL
playback: PASS|FAIL (max frames: <n>)
softlock: PASS|FAIL (turns: <n>, fingerprints: <n>)
result: Winner(team <n>)|Draw|FAIL
replay: PASS|FAIL
restore: PASS|FAIL
post_completion_immutability: PASS|FAIL
status: PASS|BLOCKED
failure: <turn, invariant, and reproduction command, or none>
```

This contract is intentionally independent of subjective preference. A
configuration can pass the technical gate and still require human fixes for
clarity, fairness, pacing, or enjoyment.
