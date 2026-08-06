# Milestone 30: Migration Items, Loadouts, And Effect Composition

## Existing Scope

`ItemDocument`, the declarative validator, inventory limits, map pickups, and
seeded economy state already exist on `staging`. They remain the canonical
serialized contracts.

## Implementation Record

Status: completed.

The missing boundary is KORE SDK authoring for validated item documents,
composed item effects, loadouts, pickups, seeded draws, and mystery-box rules.

The KORE SDK now provides validated `createItem()` and ordered
`composeItemEffects()` authoring, plus map-builder composition for registered
items, fixed loadouts, map pickups, seeded draws, and mystery-box pools. The
official item catalog uses this boundary instead of raw item literals. Economy
references are checked against the declared item registry before settings are
built, while snapshots continue to carry the existing canonical item contracts.

## Verification

- `npx tsc --noEmit`
- `bun test tests/kore_sdk.test.ts tests/item_types.test.ts tests/item_validator.test.ts tests/item_inventory.test.ts tests/item_economy_settings.test.ts tests/item_pickups.test.ts tests/mystery_box_item.test.ts`
- Broader item subsystem: `bun test tests/*item*.test.ts tests/*inventory*.test.ts tests/item_pickups.test.ts` (105 passing).
- `bun run test:fast` (691 passing, 3 skipped, 10 pre-existing repository gate failures for legacy roadmap headings and unavailable desktop artifacts).
