import { describe, expect, test } from "bun:test";
import { MATCH_LENGTH_THRESHOLDS, qualifiesMatchLengthDistribution, runPacingSuite, summarizeMatchLengths, type FuzzMatchSummary } from "./support/aiMatchFuzz.ts";

function match(turns: number, outcome: FuzzMatchSummary["outcome"], overrides: Partial<FuzzMatchSummary> = {}): FuzzMatchSummary {
	return { seed: turns, turns, acceptedActions: turns, simulatedFrames: turns * 10, engineWork: turns * 11, outcome, instantDeath: turns <= 1 && outcome !== "ongoing", turnLimit: outcome === "ongoing", violations: [], injections: 0, replayOk: true, persistedOk: true, rematchOk: true, ...overrides };
}

describe("Section 15.5 match length and pacing qualification", () => {
	test("reports deterministic duration, work, and negative-signal metrics", () => {
		const distribution = summarizeMatchLengths([match(1, "winner"), match(4, "winner"), match(8, "draw"), match(20, "ongoing")]);
		expect(distribution).toEqual({ count: 4, min: 1, median: 4, p90: 20, p95: 20, max: 20, drawRate: 0.25, instantDeathRate: 0.25, turnLimitRate: 0.25, totalAcceptedActions: 33, totalSimulatedFrames: 330, totalEngineWork: 363 });
	});

	test("uses distinct mode-specific pacing thresholds", () => {
		expect(MATCH_LENGTH_THRESHOLDS["local-ice-duel-v1"]).not.toEqual(MATCH_LENGTH_THRESHOLDS["current-turn"]);
		const healthy = summarizeMatchLengths([match(4, "winner"), match(8, "winner"), match(12, "draw"), match(16, "winner")]);
		expect(qualifiesMatchLengthDistribution("local-ice-duel-v1", healthy)).toBe(true);
		expect(qualifiesMatchLengthDistribution("current-turn", healthy)).toBe(true);
	});

	test("runs the deterministic pacing policy and satisfies the mode threshold", () => {
		const previousLog = console.log;
		console.log = () => undefined;
		try {
			const first = summarizeMatchLengths(runPacingSuite());
			const second = summarizeMatchLengths(runPacingSuite());
			expect(first).toEqual(second);
			expect(first).toMatchObject({ count: 10, min: 3, median: 7, p90: 11, p95: 11, max: 11, drawRate: 0, instantDeathRate: 0, turnLimitRate: 0, totalAcceptedActions: 70, totalSimulatedFrames: 3030, totalEngineWork: 3100 });
			expect(qualifiesMatchLengthDistribution("current-turn", first)).toBe(true);
		} finally { console.log = previousLog; }
	}, { timeout: 120000 });
});
