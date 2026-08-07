import type { MapBoundarySettings } from "../settings/settings.js";

/** Derives a deterministic fallback identity for legacy structure documents. */
export function deriveStructureId(settings: MapBoundarySettings): string {
	if (settings.id !== undefined) return settings.id;
	const canonical = settings.type === 0
		? [settings.type, settings.x, settings.y, settings.r, settings.role ?? ""].join("|")
		: settings.type === 2
			? [settings.type, settings.x, settings.y, settings.w, settings.h, settings.role ?? ""].join("|")
			: [settings.type, settings.x, settings.y, settings.x2, settings.y2].join("|");
	let hash = 2166136261;
	for (let index = 0; index < canonical.length; index++) hash = Math.imul(hash ^ canonical.charCodeAt(index), 16777619) >>> 0;
	return `structure-${hash.toString(16).padStart(8, "0")}`;
}
