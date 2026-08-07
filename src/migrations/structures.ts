import { deriveStructureId } from "../structures/identity.js";
import type { MapBoundarySettings } from "../settings/settings.js";

/** Assigns stable IDs once while upgrading historical map geometry. */
export function migrateStructureSettings(boundaries: readonly MapBoundarySettings[]): MapBoundarySettings[] {
	return boundaries.map(boundary => ({ ...boundary, id: boundary.id ?? deriveStructureId(boundary) }));
}
