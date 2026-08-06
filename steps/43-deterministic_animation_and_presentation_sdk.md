# Milestone 43: Deterministic Animation And Presentation SDK

## Status

Implemented

## Objective

Provide renderer-independent, data-driven animation and semantic presentation
contracts without placing visual state in canonical gameplay snapshots.

## Scope

Define serializable animation declarations, presentation event vocabulary,
timelines, priorities, cancellation, and deterministic event ordering. Keep
renderers and platform outputs as adapters over those declarations.

## Required Deliverables

- Generic Engine SDK animation/presentation contracts and validation.
- KORE vocabulary for gameplay presentation events where needed.
- Explicit separation between gameplay state, event history, and visual state.
- Deterministic runtime projection and restoration tests.
- Documentation and a small renderer-neutral example.

## Acceptance Criteria

- Animation settings are JSON-safe, versioned, structurally validated, and detached.
- The same input/event trace yields the same presentation event order and timing.
- Visual-only state is absent from canonical `GameSettings` and `EngineSettings` snapshots.
- Cancellation and interruption rules are explicit and tested.
- Browser and non-browser render adapters consume the same semantic output.

## Required Verification

- SDK contract, serialization, event-order, cancellation, and browser projection tests.
- Snapshot comparison proving gameplay fingerprints ignore visual-only state.
- `npx tsc --noEmit`, examples verification, and the SDK-only guard.

## Dependencies

Depends on Milestone 40 and is the prerequisite for Milestone 44.

## Explicit Non-Goals

- No renderer-specific objects in canonical settings.
- No p5, DOM, audio-device, or Tauri APIs in the generic SDK.
- No gameplay rule changes hidden inside presentation events.
