# Canonical Playable Match

The supported local reference slice is **Local Ice Duel v1**: two hotseat human
teams, one figure each, on the 800×450 Ice Map with fit-world framing. It uses
physics-only turns, no items or AI, and authoritative last-team-standing winner
or draw results. `createCanonicalPlayableMatchSettings()` returns its stable,
validated settings; `createCanonicalPlayableMatchHandler()` installs the same
`WinningSystem` used by authoritative completion.

The first legal action is a normal active-team drag/shot. Automated headless
completion currently uses team 0's `220°`, power `10` shot, which reaches an
existing Ice Map death circle and awards team 1. This is a deterministic test
witness, not player guidance; Task 14.3 replaces the provisional geometry.
