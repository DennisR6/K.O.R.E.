# Performance Persistence

Completed online matches can submit one versioned aggregate report through
`POST /api/games/<gameId>/performance`.

The browser receives the server-owned `gameId` in `NetworkInit` and submits
the WebSocket-resolved user ID with aggregated Handler runtime logs. The
server requires game membership and a completed lifecycle. Uploads are
best-effort from the client and idempotent for `gameId + userId + schemaVersion`.

`game_performance_reports` stores match summaries. The normalized
`game_turn_performance` table stores only per-turn metrics plus game, user,
turn, and team identifiers. Replay actions and canonical state remain in the
existing game/replay storage. Both tables are foreign-keyed to `games`.

`aggregatePerformanceLogs()` produces percentile summaries (`count`, `min`,
`median`, `p90`, `p95`, `max`). Frame and event-loop values are window-level
observations because the runtime logger intentionally does not retain raw
frame samples.
