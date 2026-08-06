# Step 27: SDK Migration Inventory And Contract Freeze

- **Status**: `[x]` Completed
- **Branch**: `milestone-27-sdk-migration-inventory`
- **Implementation Commit Hash**: `73787b2`
- **Merge Result**: not merged; the pre-existing fast-suite baseline is failing

## Objective

Inventory every remaining production authoring path that constructs or configures
gameplay, UI, audio, AI, maps, persistence, or platform composition. Classify
each path as an Engine SDK contract, KORE SDK contract, runtime factory,
platform adapter, or removal candidate, and freeze the supported authoring
boundary before the later migration milestones.

## Planned Deliverables

- A machine-readable inventory covering all in-scope production paths.
- A validator/test that rejects unclassified paths and malformed classifications.
- A frozen contract document describing the Engine SDK -> KORE SDK -> application
  layering and allowed runtime boundaries.
- Focused tests proving inventory completeness and contract validation.
- Updated documentation and milestone evidence after diagnostics and fast tests.

## Implementation Record

Implemented the machine-checkable migration inventory in
`src/sdkMigration/inventory.ts`. It classifies every TypeScript module under
`src/`, validates the frozen classification vocabulary and migration targets,
and records the direct legacy construction/configuration/deserialization paths
discovered during the audit. Added `SDK_MIGRATION_CONTRACT.md` to freeze the
Engine SDK -> KORE SDK -> application/adapter layering and runtime-factory
rules.

## Evidence

- `tests/sdk_migration_inventory.test.ts`: 2 passed; all production TypeScript
  modules classified and audited legacy paths present.
- `npx tsc --noEmit`: passed.
- `git diff --check`: passed.
- `bun run test:fast`: 689 passed, 3 skipped, 10 pre-existing failures. The
  failures are stale section-based roadmap assertions, missing packaging
  artifacts, and an existing vertical-slice interaction failure; no failure
  references the milestone implementation.
