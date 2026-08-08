import { deriveStructureId } from "../structures/identity.js";
import type { MapBoundarySettings } from "../settings/settings.js";

/** Assigns stable IDs once while upgrading historical map geometry. */
export function migrateStructureSettings(boundaries: readonly MapBoundarySettings[]): MapBoundarySettings[] {
	const derivedCounts = new Map<string, number>();
	const migrated = boundaries.map(boundary => {
		if (boundary.id !== undefined) return { ...boundary };
		const baseId = deriveStructureId(boundary);
		const occurrence = derivedCounts.get(baseId) ?? 0;
		derivedCounts.set(baseId, occurrence + 1);
		return { ...boundary, id: occurrence === 0 ? baseId : `${baseId}-${occurrence}` };
	});
	const ids = new Set<string>();
	for (const boundary of migrated) {
		if (ids.has(boundary.id!)) throw new Error(`Duplicate Structure ID '${boundary.id!}'`);
		ids.add(boundary.id!);
	}
	return migrated;
}

/** Converts historical contact keys that encoded Structure array positions. */
export function migratePhysicsContactPair(pair: string, boundaries: readonly MapBoundarySettings[]): string {
	if (pair.includes("|")) return pair;
	const structureMarker = ":structure:";
	const structureOffset = pair.lastIndexOf(structureMarker);
	if (structureOffset >= 0) {
		const entity = pair.slice(0, structureOffset);
		const index = parseStructureIndex(pair.slice(structureOffset + structureMarker.length), boundaries.length);
		return `${entity}|structure:${boundaries[index]!.id!}`;
	}
	const entityMatch = /^entity:([^:]+):entity:(.+)$/.exec(pair);
	if (entityMatch) {
		const left = `entity:${entityMatch[1]!}`;
		const right = `entity:${entityMatch[2]!}`;
		return left < right ? `${left}|${right}` : `${right}|${left}`;
	}
	throw new Error("Invalid historical physics contact pair");
}

function parseStructureIndex(value: string, length: number): number {
	if (!/^\d+$/.test(value)) throw new Error("Invalid historical Structure index");
	const index = Number(value);
	if (!Number.isSafeInteger(index) || index < 0 || index >= length) throw new Error("Historical Structure index is out of range");
	return index;
}
