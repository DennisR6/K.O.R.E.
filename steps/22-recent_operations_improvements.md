# Step 22: Recent Operations Improvements

- **Status**: `[x]` Completed
- **Commit Hashes**: `7a6f75e`, `501a401`

## Overview

Added durable per-map game count/percentage metrics to operator dashboard, and explicit online leave handling returning players to fresh matchmaking.

## Implementation Details

| Feature / Area | Description | Primary Code Location |
| --- | --- | --- |
| Per-Map Metrics | Operator dashboard reports durable map usage counts, percentages, and most-played map. | `src/server/dashboard.ts` |
| Explicit Leave Flow | Online leave action ends abandoned match and resets client to matchmaking state. | `src/server/server.ts` |
