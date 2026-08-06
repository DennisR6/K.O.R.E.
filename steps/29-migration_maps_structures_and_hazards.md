# Milestone 29: Migration Maps, Structures, And Hazards

## Scope

- Add KORE SDK authoring for canonical map structures and supported force/kill-zone hazards.
- Keep map documents validated and compatible with `loadMapDocument()` and immutable map hashes.
- Preserve direct `GameSettings` builds by installing equivalent collision structures.

## Implementation Record

Status: completed.

The KORE map builder now exposes validated rectangle/circle structures plus
declarative `addKillZone()` and `addForceZone()` authoring. Hazard-generated
runtime collision structures are kept out of canonical `arenaGeometry`, so
`buildMapDocument()` and `loadMapDocument()` cannot duplicate hazards. The six
scalable catalog map factories now author through the KORE SDK while retaining
their existing IDs, dimensions, friction, spawns, structures, hazards, and
serialized map shape.

## Verification

- `npx tsc --noEmit`
- `bun test tests/kore_sdk.test.ts tests/map_document.test.ts tests/map_loader.test.ts tests/map_repository.test.ts`
- `MAP_MATRIX=1 bun test tests/shipped_map_matrix.test.ts tests/map_content_inventory.test.ts tests/map_design_contract.test.ts tests/map_loader.test.ts tests/map_repository.test.ts`
- `bun run test:fast` runs 690 passing tests but retains 10 pre-existing gate failures for legacy roadmap headings and unavailable desktop artifacts; no changed-area test failed.
