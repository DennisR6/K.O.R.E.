# Step 04: Data Contracts, Mods, And Maps

- **Status**: `[x]` Completed
- **Commit Hash**: `0f9afbe`

## Overview

Added versioned validators for game, map, and item documents, canonical maps, collision hazards, and safe editor map conversion.

## Implementation Details

| Feature / Area | Description | Primary Code Location |
| --- | --- | --- |
| Document Validation | Versioned JSON schema validators for `MapDocument`, `GameSettings`, and items. | `src/contracts/documents.ts` |
| Canonical Map Presets | Ice Map, Cue Clash, Frostbite Arena, and Magma Cradle scalable map layouts. | `src/settings/iceMap.ts`, `src/settings/cueClashMap.ts` |
| Editor Map Conversion | Validated conversion between web map editor drafts and canonical `MapDocument` format. | `src/contracts/documents.ts`, `src-website/` |
| Hazard Structures | Support for deadly circles, line boundaries, and custom collision roles. | `src/structures/DeadlyObstacleCircle.ts` |
