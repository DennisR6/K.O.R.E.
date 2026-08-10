import { describe, expect, test } from "bun:test";
import { GAMEPLAY_CONTENT_REGISTRY } from "../src/content/gameplayContentRegistry.js";
import { gameplayMatrixCases, qualifyGameplayMatrix } from "./support/gameplayQualification.js";

const matrixSuite = process.env.GAMEPLAY_MATRIX === "1" ? describe : describe.skip;

matrixSuite("Section 15.3 gameplay content matrix", () => {
	test("executes every shipped map/mode/count/economy/AI/seed combination", async () => {
		const cases = gameplayMatrixCases();
		const results = await qualifyGameplayMatrix();
		expect(results).toHaveLength(cases.length);
		expect(cases.length).toBeGreaterThan(1000);
		expect(new Set(results.map(result => result.registryStatus))).toEqual(new Set(["qualified", "blocked-from-selection"]));
		expect(results.flatMap(result => result.violations)).toEqual([]);
		for (const result of results) {
			expect(result.started).toBe(true);
			expect(result.actionAccepted).toBe(true);
			expect(result.deterministic).toBe(true);
			expect(result.replayOk).toBe(true);
			expect(result.restoreOk).toBe(true);
			expect(["winner", "draw", "ongoing"]).toContain(result.outcome);
		}
	}, { timeout: 600000 });

	test("covers the registry's qualified and blocked content boundary", () => {
		const mapIds = new Set(gameplayMatrixCases().map(testCase => testCase.mapId));
		const modeIds = new Set(gameplayMatrixCases().map(testCase => testCase.modeId));
		expect(mapIds).toEqual(new Set(GAMEPLAY_CONTENT_REGISTRY.maps.map(map => map.id)));
		expect(modeIds).toEqual(new Set(GAMEPLAY_CONTENT_REGISTRY.modes.map(mode => mode.id)));
	});
});
