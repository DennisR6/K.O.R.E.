import { createInventoryItem, type InventoryItem, type ItemDocument } from "./types.js";
import type { FixedItemLoadout } from "../rules/types.js";

/** Creates one player's fixed allocation, capped by each item's game limit. */
export function createFixedLoadoutInventory(loadout: FixedItemLoadout, documents: ItemDocument[]): InventoryItem[] {
	const documentsById = new Map(documents.map(document => [document.id, document]));
	const requestedUses = new Map<string, number>();
	for (const { itemId, uses } of loadout.items) {
		if (!documentsById.has(itemId)) throw new Error(`Fixed loadout references unknown item '${itemId}'`);
		requestedUses.set(itemId, (requestedUses.get(itemId) ?? 0) + uses);
	}
	return [...requestedUses].map(([itemId, uses]) => createInventoryItem({
		itemId,
		remainingUses: Math.min(uses, documentsById.get(itemId)!.useLimit.perGame),
	}));
}

/** Consumes one inventory use after enforcing the item's per-turn and per-game limits. */
export function consumeInventoryItem(inventory: InventoryItem[], item: ItemDocument): void {
	const entry = inventory.find(candidate => candidate.itemId === item.id);
	if (!entry) throw new Error(`Item '${item.id}' is not in this inventory`);
	if (entry.remainingUses === 0) throw new Error(`Item '${item.id}' has no remaining uses`);
	if (entry.usesThisTurn >= item.useLimit.perTurn) throw new Error(`Item '${item.id}' has reached its per-turn limit`);
	entry.remainingUses--;
	entry.usesThisTurn++;
}

export function resetInventoryTurnUses(inventory: InventoryItem[]): void {
	for (const item of inventory) item.usesThisTurn = 0;
}
