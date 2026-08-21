const ITEM_ICON_IDS = new Set([
	"anker", "durchlaessigkeit", "magnet", "falltuer", "power-dash", "verzoegerte-mine",
	"mini-wall", "freeze-shot", "switch", "jaegermeister-elixier", "vodka-zero", "mystery-box",
]);

/** Returns the served icon for an official item, or undefined for mod items. */
export function itemIconSource(itemId: string): string | undefined {
	return ITEM_ICON_IDS.has(itemId) ? `public/items/${itemId}.svg` : undefined;
}
