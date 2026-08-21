import type { MatchResult } from "../rules/types.js";
import { GameDatabase, type RankedFinalization, type RankedSeason } from "./db.js";
import { RankedQueue, type RankedQueueMatch } from "./rankedQueue.js";
import { RANKED_RULESET_VERSION } from "./ranked.js";

/** Server-side composition boundary for ranked queue, seasons, and results. */
export class RankedService {
	public readonly queue = new RankedQueue();
	public constructor(private readonly database: GameDatabase, private readonly season: RankedSeason) {
		if (season.rulesetVersion !== RANKED_RULESET_VERSION || season.status !== "active") throw new Error("Ranked service requires an active ranked-v1 season");
		if (!database.getRankedSeason(season.id)) database.createRankedSeason(season);
	}

	public enqueue(playerId: string, rating: number, region: string, now: number): void {
		if (this.season.endsAt !== null && now >= this.season.endsAt) throw new Error("Ranked season has ended");
		this.queue.enqueue({ playerId, seasonId: this.season.id, rating, region, joinedAt: now });
	}

	public matchmake(now: number, matchOrdinal = 0): RankedQueueMatch | undefined {
		return this.queue.match(now, 100, 50, matchOrdinal);
	}

	public finalize(matchId: string, result: MatchResult, players: Array<{ playerId: string; team: number }>, now: number): RankedFinalization {
		return this.database.finalizeRankedMatch({ matchId, seasonId: this.season.id, result, players, now });
	}
}
