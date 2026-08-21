# Ranked Mode Readiness

## Current conclusion

The game has a usable authoritative casual online foundation, but it is **not ready for public ranked play**. The server validates shots, owns simulation and match completion, persists lifecycle/replays, supports reconnect restoration, and records state-hash diagnostics. Ranked foundations now exist for signed sessions, rate limiting, Elo calculation, seasons, transactional rating events, leaderboard persistence, frozen map/ruleset selection, and deterministic queue/service composition. Public ranked still lacks full account lifecycle, WebSocket queue/game integration, automatic ranked result binding, penalties/moderation, and player-facing ranked UI.

## What already exists and can be reused

### Newly implemented ranked foundations

- `src/server/playerSession.ts`: signed, expiring player sessions.
- `src/server/rateLimiter.ts`: deterministic token-bucket limits; network packets are rate-limited and can require sessions through `ServerRuntime` configuration.
- `src/server/ranked.ts`: deterministic provisional Elo calculation and authoritative result-to-outcome conversion.
- `src/server/rankedQueue.ts`: season/region/rating-compatible queue with wait-time expansion.
- `src/server/rankedRuleset.ts`: frozen `ranked-v1` ruleset and deterministic map selection.
- `src/server/rankedService.ts`: queue, active-season, and result-finalization composition.
- `GameDatabase`: seasons, player ratings, idempotent ranked matches, append-only rating events, and leaderboard reads.

- Native WebSocket server and authoritative `GameRegistry`.
- Server-approved maps and server-side settings expansion.
- Durable SQLite game lifecycle and player membership.
- Reconnect restoration and surrender handling.
- Authoritative turn validation, replay persistence, and result state.
- State hashes and stale/hash-mismatch diagnostics.
- Performance and feedback telemetry.
- Deterministic maps, rules, snapshots, and replays suitable for audit.

## Blocking requirements

### 1. Player identity and authentication

Current LOGIN accepts a client-provided user ID. That is suitable for anonymous casual play but not ranked: a player can impersonate another identity or create unlimited accounts.

Implement:

- Account/session authentication with server-issued, rotating session tokens.
- Durable player profile with immutable player ID, display name, creation time, ban state, and region/locale.
- Passwordless or external login is preferable to storing passwords in this prototype.
- Reconnect must bind to the authenticated account, not an arbitrary requested ID.
- Rate limits for login, queue joins, match actions, and account creation.

### 2. Rating and competitive result ledger

Add append-only tables, never derive rating from mutable replay snapshots alone:

- `ranked_seasons(id, ruleset_version, starts_at, ends_at, status)`
- `ranked_players(season_id, player_id, rating, deviation, volatility, games, wins, losses, provisional, updated_at)`
- `ranked_matches(match_id, season_id, ruleset_version, map_id, player_a, player_b, result, reason, started_at, completed_at, finalized_at)`
- `ranked_rating_events(id, match_id, player_id, before_rating, after_rating, delta, reason, created_at)`
- `ranked_penalties(player_id, match_id, type, expires_at, reason)`

Use a known algorithm such as Glicko-2 or Elo with provisional games. Keep all changes idempotent by unique match/result keys and finalize both players in one transaction.

### 3. Ranked matchmaking queue

Current matchmaking is FIFO with optional map/mode/friend preferences. Ranked needs a separate queue:

- Queue entries tied to authenticated player and season/ruleset.
- Match only compatible ranked ruleset versions and allowed regions.
- Initial rating window, wait duration, and controlled range expansion.
- Prevent duplicate queue entries and queueing while already in a match.
- Queue cancellation and disconnect expiry.
- No friend codes or custom map preferences in ranked.
- Server-selected map rotation, visible before acceptance.
- Optional ready-check before creating the match.

### 4. Fixed competitive ruleset

Ranked cannot use the current mutable catalog defaults. Freeze a versioned ruleset containing:

- Approved map rotation and map revision hashes.
- Team order/spawn rules.
- Item economy and exact item catalog version.
- AI disabled.
- Pause/rematch behavior.
- Turn and simulation limits.
- Surrender, AFK, disconnect grace, and draw rules.

Every ranked replay and rating event must retain the ruleset version and map/content hashes.

### 5. Completion, disconnect, and anti-abuse policy

Define these outcomes before implementation:

- Normal win/loss.
- Surrender.
- Disconnect with grace period.
- Abandonment after grace period.
- Server error or invalid match: void/no rating change.
- Draw and operator termination.
- Repeated disconnects and intentional queue dodges.

The server must be the only authority that finalizes a ranked result. A client hash mismatch must trigger resynchronization or a voided match, never a client-side rating decision.

### 6. Anti-cheat and protocol hardening

The authoritative simulation prevents client-authored physics, but ranked still needs:

- Strict server-side packet/rate validation.
- Per-account and per-IP throttles.
- No client-controlled seed, map, mode, result, or rating fields.
- Replay/action audit retention for disputes.
- Detection of repeated abnormal packet timing, reconnect abuse, and collusion patterns.
- Admin tools to void a match, suspend a player, and correct a rating event with an audit trail.

### 7. Leaderboard and player-facing ranked UX

Implement only after the ledger is correct:

- Current rating, rank tier, provisional state, wins/losses, and season end date.
- Queue status and estimated wait.
- Ruleset/map preview before acceptance.
- Match found/ready countdown.
- Clear disconnect/surrender consequences.
- Match result and rating delta explanation.
- Public leaderboard with privacy-safe display names and pagination.
- Personal match history and replay links.

## Recommended delivery order

1. Fix/verify online hash mismatch recovery and authoritative completion.
2. Introduce authenticated accounts while preserving anonymous casual login.
3. Add season/ruleset/map-rotation documents and ranked-only server validation.
4. Add ranked queue and ready/cancel/disconnect lifecycle.
5. Add transactional result finalization and rating events.
6. Add penalties, rate limits, moderation, and audit tools.
7. Add ranked UI, leaderboard, history, and replay links.
8. Run controlled fairness tournaments and external ranked playtests before enabling public queue.

## Release gates

Ranked should remain disabled until all are true:

- 100+ deterministic server simulations pass with no invalid result or rating event.
- Reconnect, duplicate packet, timeout, surrender, and server-failure integration tests pass.
- Every completed ranked match has one and only one finalized result and rating event per player.
- Map/team first-turn and win-rate fairness are within documented thresholds.
- Abuse/rate-limit tests pass.
- At least two independent human players complete multiple sessions without unresolved desync, control, item, or result complaints.
- Operator can inspect and void a match without directly mutating rating history.
