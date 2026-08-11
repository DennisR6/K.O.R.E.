# Engine Extraction Boundary Cleanup Validation

## Changes

- `src/engine/Handler.ts`, `types.ts`, `runtimeFactory.ts`, `RenderContext.ts`, and `drawingEngine.ts` moved to `src/kore/runtime/`.
- Runtime diagnostics (`runtimeLog.ts`, `startupTelemetry.ts`) moved to `src/kore/runtime/`, removing application imports from the generic engine directory.
- All consumers were updated to the new KORE runtime boundary; serialized settings and runtime behavior were not changed.
- Existing `EngineSystemRegistry` remains the generic registry. Concrete system restoration stays in the KORE runtime/application layer rather than in `src/engine`.
- Added an architectural test that recursively audits `src/engine/**/*.ts` for direct imports into KORE/game domains.
- Updated migration inventory and architecture documentation.

## Coupling audit

The audit scans every TypeScript file under `src/engine` and rejects direct relative imports beginning with KORE/game domains (`kore`, `ai`, `item`, `rules`, `settings`, `content`, `server`, `scenes`, `menu`, `assetManager`, and `i18n`).

```text
Raw Engine → KORE/Game import edges: 0
Runtime Engine → KORE/Game dependencies: 0
Type-only Engine → KORE/Game dependencies: 0
Semantic coupling sites inside src/engine: 0
Actual architectural blockers: 0
```

`src/engine/sdk/entityState.ts` still imports the generic physics contract from `src/physics`; this is an internal generic-framework dependency, not a KORE/game dependency.

Game-side imports of private engine implementation paths: **0** under the approved audit. Game/KORE code consumes the public SDK subpaths and approved generic contract subpaths; KORE runtime internals are no longer under `src/engine`.

## Validation results

Passed:

- `npx tsc --noEmit`
- `bun run build`
- Engine SDK architecture and reverse-import guard: 5 passed
- Runtime logging, asset preloader, migration inventory: 18 passed
- Handler, snapshot isolation, simulation isolation, deterministic replay, migration, and legacy-boundary tests: 18 passed / 1 migration inventory test was fixed for the new path and then passed
- `git diff --check`

Current repository-wide lanes:

- `bun run test:fast`: **fails** with 766 passed, 3 skipped, 15 failed. Failures are in existing language/menu/map/content/example coverage and are not caused by TypeScript resolution; they require separate gameplay/content investigation.
- `bun run test:integration:fast`: **fails** with 147 passed, 13 failed. Failures are in existing menu hitbox, renderer stub, and offline-report UI coverage; no runtime reconstruction or snapshot failures occurred.

Browser tests were not run because the focused integration lane is not green and this change only moves source modules without changing browser behavior.

## Root-cause status

1. **KORE orchestration in Handler — resolved at boundary.** The Handler and its KORE-shaped runtime contracts now live under `src/kore/runtime/`; `src/engine` contains no Handler or game orchestration.
2. **Concrete runtime reconstruction — resolved at engine boundary.** Runtime factories and concrete reconstruction remain consumer-owned under KORE/game runtime paths. The generic engine directory contains data/capability registries, not concrete KORE constructors.
3. **Hardcoded executable system registration — resolved at engine boundary.** `EngineSystemRegistry` is the generic registry; concrete system restoration is outside `src/engine` and remains a trusted KORE runtime concern.
4. **Game-shaped generic contracts — resolved at engine boundary.** The game-shaped Handler/settings/render contracts moved with KORE runtime. Generic SDK contracts remain JSON-safe and capability-oriented.
5. **Replay reconstruction — resolved by ownership boundary, not redesign.** Replay remains a KORE application adapter and is no longer part of the generic engine directory; replay documents and deterministic behavior were unchanged.

## Baseline comparison

Baseline commit: `7b6383c` (the commit immediately before boundary cleanup).

| Lane | Baseline | Current | Comparison |
|---|---|---|---|
| `bun run test:fast` | 764 passed, 3 skipped, 16 failed | 766 passed, 3 skipped, 15 failed | 15 unchanged failures; 1 baseline-only Tauri packaging failure; no new failures |
| `bun run test:integration:fast` | 147 passed, 13 failed | 147 passed, 13 failed | All 13 failures unchanged |

The unchanged failures are content-package validation, menu pilot/language, Magma Cradle, mod-menu surface, SDK example execution, menu routing, renderer stubs, and offline-report UI coverage. The baseline-only Tauri packaging failure was not reproduced on the current branch. No failure has a new semantic signature attributable to commits `dfebae9`, `844b472`, or `dd80d8a`.

## Standalone packaging dry run

A temporary isolated package was created at `/tmp/kore-engine-dry` containing:

- `src/engine/**`
- the generic `src/physics/physics.ts` contract
- the generic random helper required by engine contracts
- standalone TypeScript/build configuration
- copied generic engine tests and a headless SDK smoke test

It passed:

- isolated TypeScript check
- isolated ESM build of Engine, UI, Audio, and Presentation SDK entry points
- 19 generic engine tests plus standalone smoke test
- source scan for KORE/game imports: zero matches

The dry run did not resolve any `src/kore/**` source files. The current source tree was also updated so the generic physics contract no longer imports KORE runtime types.

## Readiness

Unchanged red game/content tests are not extraction-induced regressions. The standalone boundary and independent generic test/build proof pass. Git history filtering and creation of the final extraction clone remain intentionally deferred to the next phase.

```text
ENGINE READY FOR REPOSITORY EXTRACTION
```
