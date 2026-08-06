import type { ItemDocument, ItemInteractionMode } from "./types.js";

export interface InstalledItemEffect {
	itemId?: string;
}

/** Resolves a pair from either item's declarative policy. */
export function itemInteractionMode(
	item: ItemDocument,
	otherItemId: string,
): ItemInteractionMode {
	return item.interaction?.with?.[otherItemId] ?? item.interaction?.mode ?? "stack";
}

/**
 * Checks all installed effects before a use mutates the target. A replacement
 * removes the complete prior item, while stacking retains declaration order.
 */
export function validateItemCombination(
	item: ItemDocument,
	installed: readonly InstalledItemEffect[],
	itemsById: ReadonlyMap<string, ItemDocument>,
): { removeItemIds: Set<string> } {
	const removeItemIds = new Set<string>();
	for (const effect of installed) {
		if (!effect.itemId) continue;
		const other = itemsById.get(effect.itemId);
		const mode = itemInteractionMode(item, effect.itemId);
		const reverse = other?.interaction?.with?.[item.id];
		const resolved = reverse ?? mode;
		if (resolved === "reject") throw new Error(`Item '${item.id}' conflicts with '${effect.itemId}'`);
		if (resolved === "replace") removeItemIds.add(effect.itemId);
	}
	return { removeItemIds };
}

export function itemOrder(item: ItemDocument): number {
	return item.interaction?.order ?? 0;
}
