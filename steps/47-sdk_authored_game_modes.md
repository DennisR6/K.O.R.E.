# Milestone 47: SDK-Authored Game Modes

## Status

Implemented

## Objective

Add multiple validated game modes through public KORE match and rule authoring.

## Scope

Define mode documents, phase progression, win conditions, item policies,
active-team rules, AI behavior, and mode-specific browser/online initialization.

## Required Deliverables

- At least two additional documented mode definitions beyond the current default.
- Public validation and deterministic rule-state transitions for each mode.
- AI, restore, replay, persistence, server initialization, and browser fixtures.
- Mode-selection metadata and migration/rejection behavior for unknown versions.

## Acceptance Criteria

- Each mode has a versioned definition and rejects invalid phase/order combinations.
- Live, restored, replayed, and authoritative server rule states are equivalent.
- AI decisions remain legal and deterministic under each mode.
- Online initialization and browser selection use the same mode definition boundary.
- Existing hotseat and versus behavior remains compatible.

## Required Verification

- Match/rule contract, AI, replay, persistence, network, and browser tests.
- Deterministic action traces and snapshot fingerprints for every mode.
- `bun run test:fast`, TypeScript, build, and SDK-only release guard.

## Dependencies

Depends on Milestone 40 and supplies mode content to Milestone 48 and Milestone 49.

## Explicit Non-Goals

- No direct `RuleInterpreter` or concrete system construction in mode content.
- No mode-specific bypass of input, server, or replay validation.
- No subjective mode-balance claim without human-playtest evidence.

## Implementation Record

- Added versioned public mode metadata and two selectable SDK-authored modes:
  `quick-slip-v1` and `power-rush-v1`.
- Shared the catalog across deterministic rules, local/AI match construction,
  SQLite-backed authoritative initialization, replay-origin snapshots, and
  SDK-authored browser menu selection.
- Online login now negotiates a validated mode preference; the authoritative
  `INIT` packet also reports the selected mode ID.
- `RulePhase.Complete` remains a runtime sentinel and is no longer emitted by
  `KoreMapBuilder` as a configured phase.
