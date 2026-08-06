# Milestone 41: SDK-Authored Tactical Item Pack

## Status

Planned

## Objective

Deliver a production-ready tactical item pack authored only through the public
KORE SDK item and effect surfaces established by Milestone 40.

## Scope

Define a cohesive set of tactical items with declarative effects, legal target
contracts, inventory limits, deterministic use behavior, and clear gameplay
roles. Item content must remain JSON data and must work through local, replay,
AI, persistence, and browser paths.

## Required Deliverables

- Versioned item documents created through `kore.createItem()`.
- Public effect composition for each item and explicit target validation.
- Inventory/loadout fixtures and deterministic item-use actions.
- Focused contracts for validation, serialization, restoration, replay, and AI.
- Browser controls and documentation for the new item pack.

## Acceptance Criteria

- Every item passes the public validator and rejects malformed or executable data.
- Every item has a deterministic target, use-limit, and effect-state contract.
- Inventory and remaining uses are identical after JSON snapshot restoration and replay.
- AI can evaluate legal item actions without bypassing the shared input boundary.
- Browser item controls exercise at least one legal and one rejected action.
- No published content imports `src/item`, `src/effects`, or other unsupported internals.

## Required Verification

- Focused item, inventory, target, replay, AI, and browser tests.
- `bun run examples:verify`, `npx tsc --noEmit`, and `bun run test:fast`.
- Deterministic fingerprints from two independent seeded runs.
- Review through the SDK-only release guard.

## Dependencies

Depends on Milestone 40 and establishes the content consumed by Milestone 42.

## Explicit Non-Goals

- No direct runtime effect or player construction in item content.
- No arbitrary code execution, dynamic module loading, or new item engine outside the SDK.
- No claim of subjective balance or human-playtest acceptance from technical tests alone.
