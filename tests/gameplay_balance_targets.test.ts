import { expect, test } from "bun:test";
import { GAMEPLAY_BALANCE_TARGETS } from "../src/content/balanceTargets.ts";
import { computeSummary } from "./support/matrixSummary.ts";

test("gameplay balance guardrails are explicit and stable", () => {
	expect(GAMEPLAY_BALANCE_TARGETS).toEqual({
		minimumAcceptedActions: 1.5,
		maximumOngoingRate: 0.25,
		maximumFirstTurnWinRate: 0.25,
		maximumSideImbalance: 0.25,
		maximumDurationOutlierFactor: 3,
		maximumDurationOutlierOffset: 1,
	});
});

test("matrix qualification uses the shared balance guardrails", () => {
	const run = (overrides: Record<string, unknown> = {}) => ({
		mapId: "aurora-basin",
		variant: "base",
		policy: "easy",
		seed: 1,
		result: "winner",
		winnerTeam: 0,
		firstTeam: 0,
		turns: 4,
		acceptedActions: 1,
		simulatedFrames: 10,
		engineWork: 10,
		checks: {
			schemaValid: true, finiteSpawn: true, uniqueSpawn: true, noSolidOverlap: true,
			noLethalOverlap: true, containmentValid: true, legalFirstAction: true,
			boundedPlayback: true, deterministic: true, snapshotRestore: true,
			replayEquality: true, noPostCompletionMutation: true,
		},
		spawnFindings: [], invariantFindings: [], replayRestoreStatus: "ok",
		...overrides,
	});
	const summary = computeSummary([run(), run({ firstTeam: 1, winnerTeam: 0 })] as never);
	expect(summary.warnings).toContain("weak agency: mean 1.00 accepted actions per run");
	expect(summary.warnings.some(warning => warning.startsWith("first-turn advantage"))).toBe(false);
});
