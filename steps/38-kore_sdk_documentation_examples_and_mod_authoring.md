# Milestone 38: KORE SDK Documentation, Examples, And Mod Authoring

## Status

Completed on branch `milestone-38-sdk-docs-mod-authoring`.

## Delivered

- Published `docs/sdk-authoring-guide.md` covering the Engine SDK -> KORE SDK ->
  application layering model, supported authoring APIs, lifecycle boundaries,
  migration guidance, mod authoring, and unsupported internals.
- Added six runnable TypeScript examples covering generic Engine SDK worlds,
  KORE map and item mods, match authoring/runtime restoration, UI, and audio.
- Added `examples/tsconfig.json` so examples are checked under the repository's
  strict TypeScript settings without changing the production source include.
- Added `tests/sdk_examples_ci.test.ts`, which compiles every example through the
  TypeScript compiler API, executes every example, checks deterministic results,
  and guards the published guide's required sections.
- Linked the guide and examples from `README.md` and `SDK_ARCHITECTURE.md`.

## Evidence

- Implementation commit: `6d034a1`.
- `bun test tests/sdk_examples_ci.test.ts`: 3 pass, 0 fail.
- `npx tsc -p examples/tsconfig.json --noEmit`: passed.
- `npx tsc --noEmit`: passed.
- `bun run build`: passed.
- `bun run test:fast`: 718 pass, 3 skip, 0 fail.
