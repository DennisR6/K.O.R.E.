import { describe, expect, test } from "bun:test";
import { runFairnessTournament } from "./support/gameplayFairnessTournament.ts";

describe("Section 15.6 mirrored gameplay fairness tournament", () => {
	test("runs original, side-swapped, and first-turn-swapped seeded matches", () => {
		const tournament = runFairnessTournament();
		expect(tournament.matches).toHaveLength(24);
		expect(tournament.matches.flatMap(match => match.violations)).toEqual([]);
		for (const distribution of Object.values(tournament.distributions)) {
			expect(distribution.matches).toBe(8);
			expect(distribution.leftWins + distribution.rightWins + distribution.draws + distribution.ongoing).toBe(8);
		}
		// Fairness imbalance is evidence for review, not a release gate yet.
		expect(tournament.warnings).toEqual(expect.any(Array));
	});

	test("is deterministic for every mirrored seed", () => {
		expect(runFairnessTournament([3201, 3202])).toEqual(runFairnessTournament([3201, 3202]));
	});
});
