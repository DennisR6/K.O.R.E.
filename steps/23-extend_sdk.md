# Step 23: Extend SDK

- **Status**: `[x]` Completed
- **Commit Hash**: `57d0112`

## Overview

Extended generic Engine SDK, UI SDK, Audio SDK, and KORE SDK architecture for decoupled entity capability authoring, generic framework selection, enum-backed UI/HUD vocabularies, and semantic sound dispatching.

## Implementation Details

| Feature / Area | Description | Primary Code Location |
| --- | --- | --- |
| Generic Engine SDK | `engine.createWorld()` and `EngineSystemRegistry` for JSON-safe entity/structure/effect maps. | `src/engine/sdk/index.ts` |
| Generic UI SDK | Generic UI menu runtime with explicit `tick(input, dt)` and `draw(renderer)` calls. | `src/engine/ui-sdk/index.ts` |
| Generic Audio SDK | Semantic sound command dispatching, persistent intent buffering, and bus controls. | `src/engine/audio-sdk/index.ts` |
| KORE SDK Authoring | `kore.createDefaultMap()`, `kore.createTeam()`, and framework metadata defaults. | `src/kore/sdk/index.ts` |
