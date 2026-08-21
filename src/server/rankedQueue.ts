import { RANKED_RULESET_VERSION } from "./ranked.js";
import { rankedMapForMatch } from "./rankedRuleset.js";

export type RankedQueueEntry = {
	playerId: string;
	seasonId: string;
	rating: number;
	region: string;
	joinedAt: number;
};

export type RankedQueueMatch = {
	first: RankedQueueEntry;
	second: RankedQueueEntry;
	rulesetVersion: typeof RANKED_RULESET_VERSION;
	mapId: string;
};

/** Deterministic in-memory ranked queue; persistence/authentication remains a server boundary. */
export class RankedQueue {
	private readonly entries = new Map<string, RankedQueueEntry>();

	public enqueue(entry: RankedQueueEntry): void {
		if (!entry.playerId || !entry.seasonId || !entry.region || !Number.isSafeInteger(entry.rating) || entry.rating < 100 || !Number.isSafeInteger(entry.joinedAt) || entry.joinedAt < 0) throw new Error("Malformed ranked queue entry");
		if (this.entries.has(entry.playerId)) throw new Error("Player is already in the ranked queue");
		this.entries.set(entry.playerId, structuredClone(entry));
	}

	public cancel(playerId: string): boolean { return this.entries.delete(playerId); }
	public has(playerId: string): boolean { return this.entries.has(playerId); }
	public size(): number { return this.entries.size; }

	public match(now: number, initialRange = 100, expansionPerSecond = 50, matchOrdinal = 0): RankedQueueMatch | undefined {
		const candidates = [...this.entries.values()].sort((a, b) => a.joinedAt - b.joinedAt || a.playerId.localeCompare(b.playerId));
		for (const first of candidates) {
			const waitSeconds = Math.max(0, Math.floor((now - first.joinedAt) / 1000));
			const range = initialRange + waitSeconds * expansionPerSecond;
			const second = candidates.find(candidate => candidate.playerId !== first.playerId && candidate.seasonId === first.seasonId && candidate.region === first.region && Math.abs(candidate.rating - first.rating) <= range);
			if (!second) continue;
			this.entries.delete(first.playerId); this.entries.delete(second.playerId);
			return { first: structuredClone(first), second: structuredClone(second), rulesetVersion: RANKED_RULESET_VERSION, mapId: rankedMapForMatch(first.seasonId, matchOrdinal) };
		}
		return undefined;
	}
}
