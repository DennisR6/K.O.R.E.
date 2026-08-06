# Milestone 36: Migration Application Bootstraps And Platform Adapters

## Status

Completed on branch `milestone-36-application-bootstraps`.

## Delivered

- Browser local startup now composes the handler through
  `kore.createHandler(GameSettings)` and attaches UI/input systems through the
  runtime adapter API.
- Browser online initialization restores the server-provided
  `EngineSettings` through `kore.restoreHandler()` before attaching network UI
  adapters.
- The browser entry point no longer imports or constructs
  `GameHandlerBuilder`; platform concerns remain limited to p5, WebSocket,
  DOM, audio, and service-worker adapters.
- Replay and menu runtime placeholders remain explicitly adapter-owned and do
  not author gameplay settings.

## Evidence

- `tests/application_bootstrap.test.ts`
- `tests/browser/browser_startup.e2e.test.ts`
- Focused bootstrap/input/audio verification passed 5 tests and 15 assertions.
- Browser startup/menu smoke verification passed 10 tests.
- `bun run build` passed.
- TypeScript verification: `npx tsc --noEmit` passed.
