# Milestone 49: New Content Cross-System Qualification

## Status

Implemented, with explicit technical skips and human-evidence blockers

## Objective

Qualify all content introduced by Milestones 41 through 48 across every
authoritative runtime and release boundary.

## Scope

Exercise content through deterministic local matches, AI, replay, snapshots,
persistence, approved repositories, reconnect, online initialization, browser,
desktop, and mod validation.

## Required Deliverables

- A content inventory mapping every new item, map, mechanic, mode, and package fixture to tests.
- Shared deterministic fingerprints and action-trace comparison helpers.
- Cross-system qualification matrix with explicit unsupported/blocked cells.
- Browser and desktop content smoke paths and final issue classification.

## Implementation Record

- Added the source-owned `CONTENT_ARTIFACT_INVENTORY` and complete
  `CONTENT_QUALIFICATION_MATRIX` in `src/content/qualification.ts`.
- Added canonical JSON, deterministic fingerprint, and action-trace comparison
  helpers shared by the focused cross-system qualification tests.
- Added explicit pass/skip/blocked evidence coverage in
  `tests/content_cross_system_qualification.test.ts` without changing existing
  subsystem gates.
- Recorded the inventory, matrix, evidence, and remaining human/platform
  blockers in `docs/content-qualification-report.md`.

## Acceptance Criteria

- Every new content artifact has at least one deterministic end-to-end qualification path.
- Live, restored, replayed, persisted, and reconnected results match for supported scenarios.
- AI decisions are legal and reproducible for every applicable item, map, and mode.
- Approved repository and package validators reject unsupported content consistently.
- Browser and desktop paths consume the same SDK-authored content without legacy composition.
- Human-only or subjective evidence is separately marked pending rather than implied by automation.

## Required Verification

- Full content matrix, replay/persistence/network suites, browser full suite, and desktop build.
- SDK-only import gate, examples gate, TypeScript, production build, and deterministic fingerprints.

## Dependencies

Depends on Milestones 41, 42, 43, 44, 45, 46, 47, and 48.

## Explicit Non-Goals

- No weakening of an individual subsystem gate to make the matrix pass.
- No automatic conversion of subjective playtest findings into technical invariants.
- No new content feature work during qualification except fixes required by a classified failure.
