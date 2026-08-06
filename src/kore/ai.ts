import { AiTurnEmitter, type IAiTurnProducer } from "../ai/aiEmitter.js";
import { EasyAi } from "../ai/easyAi.js";
import { HardAi } from "../ai/hardAi.js";
import { MediumAi } from "../ai/mediumAi.js";
import { validateAiSettings, type AiDifficulty, type AiDecisionLimits, type AiSettings } from "../ai/types.js";

export interface KoreAiInput {
	difficulty: AiDifficulty;
	seed: number;
	team: number;
	decisionLimits?: AiDecisionLimits;
}

/** Creates a detached, validated AI profile for settings and replay input. */
export function createAiSettings(input: KoreAiInput): AiSettings {
	const settings = {
		difficulty: input.difficulty,
		seed: input.seed,
		team: input.team,
		...(input.decisionLimits === undefined ? {} : { decisionLimits: { ...input.decisionLimits } }),
	};
	validateAiSettings(settings);
	return structuredClone(settings);
}

/** Creates the runtime producer selected by a validated KORE AI profile. */
export function createAiProducer(settings: AiSettings): IAiTurnProducer {
	validateAiSettings(settings);
	switch (settings.difficulty) {
		case "easy": return new EasyAi();
		case "medium": return new MediumAi();
		case "hard": return new HardAi();
	}
}

/** Creates the validated decision-to-input boundary used by AI systems. */
export function createAiTurnEmitter(settings: AiSettings): AiTurnEmitter {
	return new AiTurnEmitter(createAiProducer(settings));
}

export const koreAi = {
	createSettings: createAiSettings,
	createProducer: createAiProducer,
	createTurnEmitter: createAiTurnEmitter,
} as const;
