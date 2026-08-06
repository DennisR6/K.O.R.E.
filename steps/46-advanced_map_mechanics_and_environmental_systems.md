# Milestone 46: Advanced Map Mechanics And Environmental Systems

## Status

Complete

## Objective

Extend map authoring with reusable deterministic environmental mechanics while
preserving snapshot, replay, and repository compatibility.

## Scope

Consider timed hazards, triggered zones, temporary barriers, force fields,
moving structures, and environmental cycles as validated data-driven mechanics.

## Required Deliverables

- Versioned declarative settings for each accepted mechanic.
- Deterministic tick/order/lifecycle contracts and safe cleanup behavior.
- Map builder and document conversion support through public KORE APIs.
- Persistence, replay, AI, repository, and browser fixtures.

## Acceptance Criteria

- Every mechanic validates finite bounds, timing, ownership, and lifecycle state.
- Identical seeds and inputs yield identical activation order and final snapshots.
- Mid-cycle snapshots restore without skipped, duplicated, or stale activations.
- Unsupported or malformed mechanics are rejected before runtime mutation.
- Existing maps and physics contracts remain behaviorally unchanged.

## Required Verification

- Mechanic unit tests, physics/contact tests, snapshot/replay tests, and map matrix tests.
- Approved repository and reconnect continuation tests.
- `npx tsc --noEmit`, `bun run test:fast`, and browser map verification.

## Dependencies

Depends on Milestone 45. Its reusable mechanics feed Milestones 49 and 50.

## Implementation Record

Added versioned KORE-authored environmental mechanics and the deterministic
`core.environmental` system. Canonical map loading, direct engine settings,
snapshot restoration, and unsupported mechanic rejection use the same validated
declarative boundary. Lifecycle state is tick-based and includes activation,
trigger, cycle, and moving-structure progress.

## Explicit Non-Goals

- No nondeterministic timers or wall-clock simulation.
- No direct system/structure construction in maps or mods.
- No unversioned changes to canonical snapshot contracts.
