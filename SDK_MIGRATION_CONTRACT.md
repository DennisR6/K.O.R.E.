# SDK Migration Contract

This document freezes the authoring boundary for the incremental SDK migration.
The machine-readable source of truth is
`src/sdkMigration/inventory.ts`; `tests/sdk_migration_inventory.test.ts`
validates that every production TypeScript module is classified.

## Layer Model

```text
Engine SDK -> KORE SDK -> application and platform adapters
                         -> runtime factories/deserializers
```

- **Engine SDK** owns generic JSON-safe world, entity, structure, effect, UI,
  audio, and framework contracts. It must not import KORE or application code.
- **KORE SDK** owns KORE vocabulary, presets, validated authoring helpers, and
  composition built on Engine SDK contracts.
- **Runtime factories** are the only allowed boundaries for constructing legacy
  runtime objects from canonical settings.
- **Adapters** own IO, persistence, transport, rendering, browser/device APIs,
  and external integrations. They may invoke SDK APIs but do not define a
  parallel gameplay authoring model.
- **Removal candidates** are existing production modules whose authoring or
  composition paths are explicitly assigned to milestones 28-36. They remain
  behaviorally active during incremental migration and are not silently treated
  as supported SDK authoring APIs.

## Frozen Rules

1. Settings and documents remain the canonical serialized state.
2. SDK builders return detached, validated, JSON-safe settings.
3. Runtime construction from settings stays inside factories, deserializers,
   replay restoration, or authoritative platform boundaries.
4. New production authoring paths must be added to the inventory and assigned a
   classification before implementation.
5. A later milestone may reclassify a path only with focused compatibility and
   snapshot tests; it may not bypass the inventory.

## Migration Queue

The `targetMilestone` fields in the inventory are the frozen queue. In
particular, match composition is milestone 28, maps and hazards 29, items 30,
UI 31, input 32, audio 33, AI 34, persistence/replay/network 35, and bootstraps
and platform adapters 36.
