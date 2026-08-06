# Milestone 42: Item Interaction And Combination Qualification

## Status

Planned

## Objective

Prove that the tactical item pack remains deterministic and safe when items are
combined, opposed, repeated, cancelled, or restored across all supported paths.

## Scope

Qualify effect ordering, stacking rules, conflict resolution, durations,
cleanup, cancellation, target ownership, and invalid combinations for the
Milestone-41 item set.

## Required Deliverables

- A documented interaction matrix for supported item pairs and sequences.
- Deterministic composition and cleanup tests at the serialized boundary.
- Invalid-combination and phase/target rejection tests.
- Replay, AI, persistence, and reconnect fixtures for representative combos.

## Acceptance Criteria

- Each supported pair has an explicit result, rejection, or ordering rule.
- Repeated runs produce byte-equivalent final snapshots and action traces.
- Temporary effects expire exactly at their declared boundary and leave no stale state.
- Invalid combinations fail before mutating inventory, entities, or rule state.
- Replay and restored handlers match live inventory, effects, and match progression.

## Required Verification

- Interaction matrix tests, snapshot tests, replay tests, and AI decision tests.
- Negative target, phase, ownership, duration, and conflict cases.
- `bun run test:fast`, focused cross-system qualification, and browser item flow.

## Dependencies

Depends on Milestone 41. Its interaction contracts are inputs to Milestone 49.

## Explicit Non-Goals

- No undocumented effect stacking or silent compatibility aliases.
- No direct imports from internal effect or item runtime modules in content.
- No subjective balance conclusion without separate human evidence.
