# Step 20: Online Match Operations, Sharing, And Player Support

- **Status**: `[x]` Completed
- **Commit Hash**: `7738517`

## Overview

Added authoritative online map selection, pause/report/leave flows, reconnect-safe lifecycle handling, replay sharing, and operator dashboard operations.

## Implementation Details

| Feature / Area | Description | Primary Code Location / Evidence |
| --- | --- | --- |
| Reconnect & Lifecycle | Reconnect restoration, sleeping/resident match lifecycle state, and clean disconnects. | `src/server/server.ts` |
| Operator Dashboard | Authenticated `/operator/dashboard` metrics and `/operator/replays` archive routes. | `src/server/dashboard.ts` |
| Replay Tokens | Unbroadcast replay token generation and public share link routing. | `src/net/offlineMatchReport.ts`, `src/server/db.ts` |
