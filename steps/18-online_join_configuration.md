# Step 18: Online Join Configuration

- **Status**: `[x]` Completed
- **Commit Hash**: `233340a`

## Overview

Browser online join configuration that derives the WebSocket URL from the page origin or server configuration endpoint and preserves deployment subpaths.

## Implementation Details

| Feature / Area | Description | Primary Code Location / Evidence |
| --- | --- | --- |
| Server Config Endpoint | `/config` JSON endpoint publishing WebSocket base URL and deployment settings. | `src/server/config.ts` |
| Client Config Parser | In-browser configuration loader for path-prefix deployments and remote servers. | `src/main.ts`, `tests/online_client_config.test.ts` |
