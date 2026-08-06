# Milestone 45: SDK-Authored Competitive Map Pack

## Status

Complete

## Objective

Add at least three production maps through the public KORE map SDK and qualify
their technical fairness and cross-system behavior.

## Scope

Author map geometry, spawns, friction/drift, hazards, map metadata, and stable
IDs through `KoreMapBuilder`. Integrate catalog, repository, AI, replay, and
browser access.

## Required Deliverables

- At least three distinct SDK-authored map documents and engine settings.
- Stable fingerprints, catalog metadata, spawn and geometry contracts.
- Repository approval/loading fixtures and map-selection browser journeys.
- AI, replay, persistence, and deterministic map matrix coverage.

## Acceptance Criteria

- Each map has a stable ID, valid two-team spawns, and validated geometry.
- Each map passes deterministic fingerprint comparison across two fresh runs.
- Each map is loadable through the approved repository boundary only.
- AI, replay, snapshot restoration, and browser selection work for every map.
- Technical fairness metrics and known limitations are recorded without claiming human qualification.

## Required Verification

- Map content inventory, map matrix, repository, AI, replay, and browser tests.
- `bun run test:maps:matrix`, `bun run test:browser:full`, and release guards.
- TypeScript, production build, and deterministic fingerprint checks.

## Dependencies

Depends on Milestone 40 and establishes content for Milestone 46 and Milestone 49.

## Explicit Non-Goals

- No editor JSON passed directly into runtime construction.
- No direct structures, effects, or settings construction in map content.
- No subjective map fairness or human-playtest approval inferred from automation.
