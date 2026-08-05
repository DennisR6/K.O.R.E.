# Step 03: Match Rules And Round Lifecycle

- **Status**: `[x]` Completed
- **Commit Hash**: `3acd06e`

## Overview

Added serialized rule phases, item turns, active-team progression, match results, and rematch handling.

## Implementation Details

| Feature / Area | Description | Primary Code Location |
| --- | --- | --- |
| Rule Phases | Data-defined rule sequence (`aim`, `charge`, `push`, `physics`) enforcing turn rules. | `src/rules/RuleInterpreter.ts` |
| Active-Team Rotation | Manages active team order and enforces per-turn item allowances. | `src/rules/types.ts` |
| Match Victory System | Evaluates team eliminate/survivor status to conclude matches and compute results. | `src/systems/WinningSystem.ts` |
| Rematch Lifecycle | Re-arms match state, resets entities and structures, and restarts turn sequence. | `src/scenes/matchPipeline.ts` |
