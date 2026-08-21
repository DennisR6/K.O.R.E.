import { FINAL_RELEASE_MAP_IDS } from "../content/mapCatalog.js";
import { RANKED_RULESET_VERSION } from "./ranked.js";

export const RANKED_RULESET = {
	version: RANKED_RULESET_VERSION,
	modeId: "quick-slip-v1",
	mapIds: [...FINAL_RELEASE_MAP_IDS],
	teamCount: 2,
	figuresPerTeam: 6,
	aiAllowed: false,
	customItemsAllowed: false,
	rematchAllowed: false,
} as const;

export function rankedMapForMatch(seasonId: string, matchOrdinal: number): string {
	if (!seasonId || !Number.isSafeInteger(matchOrdinal) || matchOrdinal < 0) throw new Error("Ranked map selection requires a season and non-negative match ordinal");
	const hash = hashText(`${seasonId}:${matchOrdinal}`);
	return RANKED_RULESET.mapIds[hash % RANKED_RULESET.mapIds.length]!;
}

export function isRankedMap(mapId: string): boolean {
	return (RANKED_RULESET.mapIds as readonly string[]).includes(mapId);
}

function hashText(value: string): number {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
	return hash >>> 0;
}
