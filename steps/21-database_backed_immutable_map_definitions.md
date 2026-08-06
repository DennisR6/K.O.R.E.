# Step 21: Database-Backed Immutable Map Definitions Checklist

- **Status**: `[x]` Completed
- **Commit Hash**: `c305b93`

## Overview

Added immutable UUID map revisions, canonical content hashes, approval/retirement lifecycle, approved-map lookup with cache refresh, and persisted match map references.

## Implementation Details

| Feature / Area | Description | Primary Code Location / Evidence |
| --- | --- | --- |
| Map Storage Schema | Versioned immutable map revision rows with canonical content hash verification. | `src/server/db.ts` |
| Map Repository | Approved-map lookup boundary rejecting draft/retired maps for new matches. | `src/server/mapRepository.ts` |
| Map Persistence | Persisted match rows linking immutable map revision UUIDs. | `tests/database_map_match_persistence.test.ts` |
