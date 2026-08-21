import { expect, test } from "bun:test";
import { calculateRankedRatingChange, rankedOutcome } from "../src/server/ranked.ts";

test("ranked Elo changes are deterministic and provisional games use the larger factor", () => {
	const player = { rating: 1000, games: 0, provisional: true };
	const opponent = { rating: 1200, games: 20, provisional: false };
	const first = calculateRankedRatingChange(player, opponent, "win");
	const second = calculateRankedRatingChange(player, opponent, "win");
	expect(first).toEqual(second);
	expect(first.after.rating).toBeGreaterThan(player.rating);
	expect(first.after.games).toBe(1);
	expect(first.after.provisional).toBe(true);
	expect(calculateRankedRatingChange(opponent, player, "loss").delta).toBeLessThan(0);
});

test("ranked results map authoritative winner and draw states to player outcomes", () => {
	expect(rankedOutcome({ status: "winner", winnerTeam: 1, reason: "last-team-standing", turnNumber: 4 }, 1)).toBe("win");
	expect(rankedOutcome({ status: "winner", winnerTeam: 1, reason: "last-team-standing", turnNumber: 4 }, 0)).toBe("loss");
	expect(rankedOutcome({ status: "draw", winnerTeam: null, reason: "draw", turnNumber: 4 }, 0)).toBe("draw");
});
