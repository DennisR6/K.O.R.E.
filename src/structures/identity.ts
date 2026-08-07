import type { MapBoundarySettings } from "../settings/settings.js";

/** Derives a deterministic fallback identity for legacy structure documents. */
export function deriveStructureId(settings: MapBoundarySettings): string {
	if (settings.id !== undefined) return settings.id;
	const canonical = JSON.stringify(settings);
	let hash = 2166136261;
	for (let index = 0; index < canonical.length; index++) hash = Math.imul(hash ^ canonical.charCodeAt(index), 16777619) >>> 0;
	return `structure-${hash.toString(16).padStart(8, "0")}`;
}
