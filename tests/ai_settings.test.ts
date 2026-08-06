import { describe, expect, test } from "bun:test";
import { validateAiSettings, type AiDifficulty, type AiSettings } from "../src/ai/types.ts";
import { createDefaultGameSettings, validateGameSettings } from "../src/settings/settings.ts";

describe("AI Settings Validation", () => {
	test("validateAiSettings accepts valid AI configuration", () => {
		const validEasy: AiSettings = {
			difficulty: "easy",
			seed: 12345,
			team: 1,
		};
		expect(() => validateAiSettings(validEasy)).not.toThrow();

		const validHard: AiSettings = {
			difficulty: "hard",
			seed: 42,
			team: 1,
			decisionLimits: {
				maxSimulations: 50,
				maxAngleSamples: 12,
				maxForceSamples: 3,
			},
		};
		expect(() => validateAiSettings(validHard)).not.toThrow();
	});

	test("validateAiSettings rejects malformed AI configuration", () => {
		expect(() => validateAiSettings(null)).toThrow();
		expect(() => validateAiSettings({})).toThrow();
		expect(() => validateAiSettings({ difficulty: "godlike", seed: 1, team: 1 })).toThrow();
		expect(() => validateAiSettings({ difficulty: "easy", seed: "123", team: 1 })).toThrow();
		expect(() => validateAiSettings({ difficulty: "easy", seed: 1, team: -1 })).toThrow();
		expect(() => validateAiSettings({ difficulty: "hard", seed: 1, team: 1, decisionLimits: { maxSimulations: -1 } })).toThrow();
	});

	test("validateGameSettings accepts valid AI settings and rejects invalid AI settings", () => {
		const baseSettings = createDefaultGameSettings();
		const validSettings = {
			...baseSettings,
			ai: {
				difficulty: "medium" as AiDifficulty,
				seed: 999,
				team: 1,
			},
		};
		expect(() => validateGameSettings(validSettings)).not.toThrow();

		const invalidSettings = {
			...baseSettings,
			ai: {
				difficulty: "invalid_diff",
				seed: 999,
				team: 1,
			},
		};
		expect(() => validateGameSettings(invalidSettings)).toThrow();
	});
});
