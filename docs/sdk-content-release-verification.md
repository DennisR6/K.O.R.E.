# Milestone 50 SDK-Authored Content Release Verification

Status: **TECHNICAL EVIDENCE RECORDED; CURRENT AGGREGATE RUN BLOCKED BY BROWSER FAILURES**

This is the aggregate release record for Milestones 41-49. It does not replace
the subsystem tests and does not claim that automation qualifies balance, feel,
or platform support. Run the fail-fast aggregate command with
`bun run content:release-gate`.

## Evidence Inventory

The source-of-truth inventory and pass/skip/blocked matrix are in
`src/content/qualification.ts`, tested by `tests/content_cross_system_qualification.test.ts`.
The aggregate gate is `tests/sdk_content_release_gate.test.ts`.

| Area | Status | Evidence |
|---|---|---|
| Package validation and canonical hashes | PASS | `tests/content_package.test.ts` |
| Presentation snapshots | PASS | `tests/presentation_sdk.test.ts` |
| Item interactions and inventory | PASS | `tests/item_interaction_qualification.test.ts`, `tests/item_inventory.test.ts` |
| Maps and deterministic fingerprints | PASS | `tests/competitive_map_pack.test.ts`, `tests/content_cross_system_qualification.test.ts` |
| Environmental mechanics | PASS | `tests/environmental_mechanics.test.ts` |
| Game modes | PASS | `tests/milestone47_game_modes.test.ts` |
| SDK imports and authoring inventory | PASS | `tests/sdk_only_release_gate.test.ts`, `tests/sdk_migration_inventory.test.ts` |
| Browser | BLOCKED for this run: 33/36 browser tests passed; 3 failed | `tests/browser/browser_release_gate.test.ts`, `bun run test:browser:full` |
| Production build | PASS | `bun run build` |
| Desktop package | PASS | `tests/desktop_packaging.test.ts`, `bun run desktop:build` |
| Package execution as a runtime | SKIP | Packages are validated declarations, not an alternate runtime. |
| Unsupported platform-specific packaging | PENDING | No claim is made for unverified platforms. |
| External human gameplay/content evidence | BLOCKED | `docs/playtest-protocol.md`; no external session is recorded. |

## Aggregate Commands

The command runs these checks sequentially and stops on the first non-zero
result. A failed command is not converted into a skip or a pass.

- `bun run content:release-gate`
- `bun run examples:typecheck`
- `bun run examples:verify`
- `bun run test:browser:full`
- `npx tsc --noEmit`
- `bun run build`
- `bun run desktop:build`

## Classification Rules

- `PASS` means the named automated contract and its command completed.
- `SKIP` means the boundary is intentionally not a runtime claim and has an explicit reason.
- `BLOCKED` means a required release decision cannot be made because evidence is absent or an external dependency remains.
- `PENDING` means evidence is expected but has not been verified; it is not a qualification.

The Milestone 49 matrix retains per-artifact statuses. Human playtest evidence
remains `BLOCKED`, and platform-specific evidence remains `PENDING`; this
document must not be changed to imply human qualification without an actual
recorded protocol session.

## Current Run Blockers

`bun run content:release-gate` stopped at `bun run test:browser:full`. The
browser run had 33 passing and 3 failing tests:

- `tests/browser/browser_ai_battle.e2e.test.ts`: human-vs-KI selection timed out.
- `tests/browser/map_catalog.e2e.test.ts`: the test expected 6 maps but found 9.
- `tests/browser/map_catalog.e2e.test.ts`: hazard-control selection timed out.

The aggregate runner stopped before its later steps on this invocation. The
independent `npx tsc --noEmit`, `bun run build`, and `bun run desktop:build`
checks passed. These browser failures are not reclassified as skips or human
evidence.

## Linked Evidence

- `tests/content_cross_system_qualification.test.ts`
- `tests/sdk_only_release_gate.test.ts`
- `tests/sdk_examples_ci.test.ts`
- `tests/presentation_sdk.test.ts`
- `tests/item_interaction_qualification.test.ts`
- `tests/item_inventory.test.ts`
- `tests/environmental_mechanics.test.ts`
- `tests/milestone47_game_modes.test.ts`
- `tests/content_package.test.ts`
- `tests/competitive_map_pack.test.ts`
- `tests/browser/browser_release_gate.test.ts`
- `tests/desktop_packaging.test.ts`
- `docs/content-qualification-report.md`
- `docs/sdk-authoring-guide.md`
- `docs/desktop-release.md`
- `docs/playtest-protocol.md`
- `steps/50-sdk_authored_content_release_gate.md`
