import { describe, expect, test } from "bun:test";
import { rcGameCount, runFuzzSuite } from "./support/aiMatchFuzz.ts";

/**
 * Section 12.12 - deterministic AI-vs-AI match fuzz suite.
 *
 * The match count is controlled by `RC_GAME_COUNT`: the default smoke run is
 * 25 matches, the RC qualification is `RC_GAME_COUNT=1000`, and the soak run
 * is `RC_GAME_COUNT=5000` (see package.json scripts). Every case is seeded,
 * so any failure is reproducible by re-running the same seed.
 */
describe("Deterministic AI-vs-AI Fuzz Suite", () => {
	const gameCount = rcGameCount();

	test(`runs ${gameCount} deterministic AI-vs-AI matches with per-match and per-turn invariants`, () => {
		const suite = runFuzzSuite({ gameCount });
		expect(suite.gameCount).toBe(gameCount);
		expect(suite.matches.length).toBe(gameCount);

		// Every invariant violation across all matches must be empty.
		const allViolations = suite.matches.flatMap((m) => m.violations);
		expect(allViolations).toEqual([]);

		// Negative actions were actually injected into the matches.
		expect(suite.injections).toBeGreaterThan(0);

		for (const match of suite.matches) {
			expect(match.turns).toBeGreaterThan(0);
			expect(["winner", "draw", "ongoing"]).toContain(match.outcome);
			expect(match.injections).toBeGreaterThan(0);
			expect(match.replayOk).toBe(true);
			expect(match.persistedOk).toBe(true);
			if (match.outcome !== "ongoing") expect(match.rematchOk).toBe(true);
		}
	}, { timeout: 600000 });

	test("re-running the same fuzz case reproduces the identical outcome", () => {
		const suite = runFuzzSuite({ gameCount: 2 });
		expect(suite.determinismVerified).toBe(true);
	});

	test("RC_GAME_COUNT controls the match count with a 25-match smoke default", () => {
		const previous = process.env.RC_GAME_COUNT;
		try {
			delete process.env.RC_GAME_COUNT;
			expect(rcGameCount()).toBe(25);
			process.env.RC_GAME_COUNT = "7";
			expect(rcGameCount()).toBe(7);
			process.env.RC_GAME_COUNT = "not-a-number";
			expect(rcGameCount()).toBe(25);
			process.env.RC_GAME_COUNT = "-3";
			expect(rcGameCount()).toBe(25);
			process.env.RC_GAME_COUNT = "0";
			expect(rcGameCount()).toBe(25);
		} finally {
			if (previous === undefined) delete process.env.RC_GAME_COUNT;
			else process.env.RC_GAME_COUNT = previous;
		}
	});
});
