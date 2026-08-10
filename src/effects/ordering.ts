/**
 * Orders installed Effects by their explicit item interaction order. Equal
 * orders retain declaration/insertion order through the explicit index tie-break.
 */
export function orderInstalledEffects<T extends { order?: number }>(effects: readonly T[]): T[] {
	return effects
		.map((effect, index) => ({ effect, index }))
		.sort((a, b) => (a.effect.order ?? 0) - (b.effect.order ?? 0) || a.index - b.index)
		.map(entry => entry.effect);
}

/** Multi Effects are intentionally ordered by their serialized child list. */
export function preserveEffectDeclarationOrder<T>(effects: readonly T[]): T[] {
	return [...effects];
}
