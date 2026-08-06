# Milestone 40: SDK-Only Release Gate

## Status

Completed on branch `milestone-40-sdk-only-release-gate`.

## Final Supported Surface

- Authoring APIs: `src/engine/sdk/index.ts`,
  `src/engine/ui-sdk/index.ts`, `src/engine/audio-sdk/index.ts`, and
  `src/kore/sdk/index.ts` through the documented `engine`, `ui`, `audio`, and
  `kore` surfaces.
- Runtime boundaries: `kore.createHandler()`,
  `kore.createRuntimeMatch()`, `kore.restoreHandler()`, replay reconstruction,
  approved map loading, authoritative server persistence/restoration, browser
  bootstrap, and Tauri packaging.
- Internal boundaries: `ItemLoader` and `ItemValidator` remain server/built-in
  runtime integration APIs, not published mod imports.

## Delivered

- Added `tests/sdk_only_release_gate.test.ts` with explicit path classification
  for removed files, builder construction, core system construction, published
  example imports/coverage, application runtime boundaries, documentation, and
  roadmap evidence links.
- Added `bun run sdk:release-gate`, covering the SDK-only gate, examples,
  Milestone-39 qualification, TypeScript, production build, fast suite,
  browser startup/menu, and Tauri desktop packaging.
- Migrated the replay viewer's placeholder `GameHandler` construction in
  `src/main.ts` to `kore.createHandler(GameSettings)`.
- Added the final SDK-only release status to `docs/sdk-authoring-guide.md` and
  `SDK_ARCHITECTURE.md`, linked from `README.md`, and documented the command in
  `AGENTS.md`.

## Evidence

- Implementation commit: `d892f19`.
- `bun test tests/sdk_only_release_gate.test.ts`: 4 pass, 0 fail, 754 assertions.
- `bun run examples:typecheck`: passed.
- `bun run examples:verify`: 4 pass, 0 fail, 33 assertions.
- Milestone-39 qualification: 6 pass, 0 fail, 24 assertions.
- `npx tsc --noEmit`: passed.
- `bun run build`: passed.
- `bun run test:fast`: 723 pass, 3 skip, 0 fail.
- `bun run test:browser:smoke`: 10 pass, 0 fail.
- `bun run desktop:build`: passed and produced:
  - `src-tauri/target/release/slipstrike`
  - `src-tauri/target/release/bundle/deb/Slipstrike_0.0.1_amd64.deb`
- Desktop binaries and `dist/` are git-ignored and were not committed.
- The three fast-suite skips remain the repository's existing intentional skips;
  external human playtest evidence remains separately blocked/pending.
