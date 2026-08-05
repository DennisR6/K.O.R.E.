# Step 05: Item Framework And Official Items

- **Status**: `[x]` Completed
- **Commit Hash**: `32f0175`

## Overview

Delivered declarative item validation, inventory tracking, deterministic draws and pickups, target validation, and official item behavior.

## Implementation Details

| Feature / Area | Description | Primary Code Location |
| --- | --- | --- |
| Declarative Validator | Strict item validator rejecting executable/unknown fields and enforcing effect whitelists. | `src/item/validate.ts` |
| Inventory System | Fixed team loadouts, per-turn usage tracking, and player snapshot serialization. | `src/item/inventory.ts` |
| Map Pickup System | Grants configured pickups when active entities enter rectangular pickup regions. | `src/item/MapPickupSystem.ts` |
| Official Items Catalog | Built-in official items (Anker, Durchlässigkeit, Magnet, Falltür, Power-Dash, Verzögerte-Mine, Mini-Wall, Freeze-Shot, Switch). | `src/item/officialItems.ts` |
