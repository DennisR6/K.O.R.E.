# Step 28: Migration Game Handler And Match Composition

- **Status**: `[x]` Completed
- **Branch**: `milestone-28-handler-match-composition`
- **Implementation Commit Hash**: <commit>
- **Merge Result**: not merged; the pre-existing fast-suite baseline is failing

## Objective

Move canonical handler construction and match composition behind the frozen
layering: a designated engine runtime handler factory owns every
`GameHandlerBuilder` construction, and the KORE SDK authors validated, detached
match definitions (map id, game mode, system profile, teams, seed). Preserve
the exact serialized settings, system order, seeds, and runtime adapters the
current prototype relies on.

## Planned Deliverables

- A designated runtime handler factory that is the only production
  `GameHandlerBuilder` construction boundary.
- KORE match authoring APIs: game mode, match system profile, match settings
  header, match definition, and runtime match construction.
- Migration of canonical match creation and the offline match pipeline to the
  new boundary with byte-identical settings and behavior.
- Focused compatibility, round-trip, and import-boundary tests.
- Updated inventory, architecture documentation, and milestone evidence.

## Implementation Record

Implemented the runtime handler factory in `src/engine/runtimeFactory.ts`
(`createRuntimeHandler`), the only permitted production `GameHandlerBuilder`
construction site; it restores engine/system snapshots through the allowlisted
factory when a system profile is given. Added the KORE match authoring module
`src/kore/sdk/match.ts`: `createGameMode` (validated through the same
`RuleInterpreter` boundary the runtime uses), `createMatchSystemProfile`
(EngineSystemRegistry-selected playback -> physics -> boundary ->
game-state-manager -> winning profile with the exact initial runtime states),
`authorMatchSettings` (canonical match id, teams, player ids, items, game
mode), `createMatchDefinition`/`validateKoreMatchDefinition` (versioned,
JSON-safe, seed-validated), and `createRuntimeMatch`. Exposed all APIs on the
`kore` SDK object and re-exported the new types.

Migrated `src/settings/canonicalPlayableMatch.ts` and
`src/scenes/matchPipeline.ts` to the new boundary: both now author their match
through `kore.createMatchDefinition` and construct the handler through
`kore.createRuntimeMatch`, keeping the canonical settings snapshot
(containment, boundaries, mode, fixed loadouts) and all pipeline seeds and
transport adapters (UiSystem, EmitterSystem, CombiEmitter, GameEmitter,
AiOpponentSystem, AiBattleSystem) unchanged. Map geometry authoring
(boundary/containment roles) remains legacy until milestone 29. Updated the
migration inventory with the runtime-factory classification and refreshed the
milestone-28 audit notes.

## Evidence

- `tests/match_sdk_migration.test.ts`: 7 passed; game-mode authoring/validation
  and detachment, deterministic hydratable system profile, settings header
  authoring, definition validation and JSON safety, runtime match round trips
  through the factory, construction confinement to the runtime boundary, and
  canonical settings parity.
- Focused migration suite: 47 passed across 16 files (canonical match,
  pipeline unification, phase integration, engine/KORE SDK architecture,
  inventory, scene rendering, match-end UI, AI battle seed variation, menu
  start, offline report, reference spawn/camera/map validation, database map
  persistence, map repository).
- `node_modules/.bin/tsc --noEmit`: passed.
- `git diff --check`: passed.
- `bun run test:fast`: 696 passed (689 baseline + 7 new), 3 skipped, 10
  failures. 8 failures are identical to the milestone-27 pre-existing baseline
  (stale roadmap assertions, human-evidence/qualification records, vertical
  slice interaction failure); the 2 packaging failures are worktree-local
  because `src-tauri/target/` build artifacts are absent in this worktree.
  No failure references the milestone implementation.
