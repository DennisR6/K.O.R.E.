# Milestone 35: Migration Persistence, Replay, And Network Boundaries

## Status

Completed on branch `milestone-35-persistence-replay-network`.

## Delivered

- KORE SDK now exposes `restoreHandler()` as the canonical persisted
  `EngineSettings` runtime boundary.
- Authoritative server match restoration uses KORE create/restore entry points
  instead of constructing `GameHandlerBuilder` directly.
- Replay playback restores serialized engine origins through the same KORE
  boundary and only adds the winning system when the snapshot does not already
  contain it, preventing duplicate system IDs.
- Existing immutable replay origins, snapshots, replay shares, and typed
  network packets remain structurally compatible.

## Evidence

- `tests/persisted_match_continuation.test.ts`
- `tests/replay_origin_repro.test.ts`
- `tests/deterministic_replay.test.ts`
- `tests/network_replays.test.ts`
- `tests/server_match_metrics.test.ts`
- `tests/shared_match_replay.test.ts`
- `tests/replay_share_security.test.ts`
- `tests/replay_share_participants.test.ts`
- `tests/persisted_match_status.test.ts`
- `tests/database_map_match_persistence.test.ts`
- `tests/e2e_network_match.test.ts`
- `tests/kore_replay_viewer.test.ts`
- Persistence/replay/network verification passed in the focused suites.
- TypeScript verification: `npx tsc --noEmit` passed.
