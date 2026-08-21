import type { MatchResult } from "../rules/types.js";

export const RANKED_RULESET_VERSION = "ranked-v1" as const;
export type RankedOutcome = "win" | "loss" | "draw";

export type RankedRating = {
	rating: number;
	games: number;
	provisional: boolean;
};

export type RankedRatingChange = {
	before: RankedRating;
	after: RankedRating;
	delta: number;
};

/**
 * Deterministic Elo foundation for ranked result finalization. The server must
 * call this only after validating and transactionally finalizing a match.
 * Provisional players use a larger K factor for their first ten games.
 */
export function calculateRankedRatingChange(rating: RankedRating, opponent: RankedRating, outcome: RankedOutcome): RankedRatingChange {
	validateRating(rating);
	validateRating(opponent);
	const expected = 1 / (1 + Math.pow(10, (opponent.rating - rating.rating) / 400));
	const actual = outcome === "win" ? 1 : outcome === "loss" ? 0 : 0.5;
	const k = rating.provisional ? 40 : 24;
	const delta = Math.round(k * (actual - expected));
	const games = rating.games + 1;
	return { before: structuredClone(rating), after: { rating: Math.max(100, rating.rating + delta), games, provisional: games < 10 }, delta };
}

/** Converts an authoritative two-player result into a stable ranked outcome. */
export function rankedOutcome(result: MatchResult, playerTeam: number): RankedOutcome {
	if (result.status === "draw" || result.winnerTeam === null) return "draw";
	if (!Number.isSafeInteger(playerTeam) || playerTeam < 0) throw new Error("Ranked player team must be a non-negative integer");
	return result.winnerTeam === playerTeam ? "win" : "loss";
}

function validateRating(value: RankedRating): void {
	if (!Number.isSafeInteger(value.rating) || value.rating < 100 || value.rating > 5000) throw new Error("Ranked rating must be a safe integer between 100 and 5000");
	if (!Number.isSafeInteger(value.games) || value.games < 0) throw new Error("Ranked games must be a non-negative safe integer");
	if (typeof value.provisional !== "boolean") throw new Error("Ranked provisional state must be boolean");
}
