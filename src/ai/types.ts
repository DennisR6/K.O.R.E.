export type AiDifficulty = "easy" | "medium" | "hard";

export interface AiDecisionLimits {
	maxSimulations?: number;
	maxAngleSamples?: number;
	maxForceSamples?: number;
}

export interface AiSettings {
	difficulty: AiDifficulty;
	seed: number;
	team: number;
	decisionLimits?: AiDecisionLimits;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateAiSettings(settings: unknown): asserts settings is AiSettings {
	if (!isRecord(settings)) {
		throw new Error("AI settings must be an object");
	}
	if (settings.difficulty !== "easy" && settings.difficulty !== "medium" && settings.difficulty !== "hard") {
		throw new Error("AI difficulty must be 'easy', 'medium', or 'hard'");
	}
	if (typeof settings.seed !== "number" || !Number.isSafeInteger(settings.seed)) {
		throw new Error("AI seed must be an integer");
	}
	if (typeof settings.team !== "number" || !Number.isSafeInteger(settings.team) || settings.team < 0) {
		throw new Error("AI team must be a non-negative integer");
	}
	if (settings.decisionLimits !== undefined) {
		if (!isRecord(settings.decisionLimits)) {
			throw new Error("AI decision limits must be an object");
		}
		const { maxSimulations, maxAngleSamples, maxForceSamples } = settings.decisionLimits;
		if (maxSimulations !== undefined && (typeof maxSimulations !== "number" || !Number.isSafeInteger(maxSimulations) || maxSimulations <= 0)) {
			throw new Error("maxSimulations must be a positive integer");
		}
		if (maxAngleSamples !== undefined && (typeof maxAngleSamples !== "number" || !Number.isSafeInteger(maxAngleSamples) || maxAngleSamples <= 0)) {
			throw new Error("maxAngleSamples must be a positive integer");
		}
		if (maxForceSamples !== undefined && (typeof maxForceSamples !== "number" || !Number.isSafeInteger(maxForceSamples) || maxForceSamples <= 0)) {
			throw new Error("maxForceSamples must be a positive integer");
		}
	}
}
