import { CombiEmitter } from "../emitter/InputEmitter.js";
import { GameEmitter } from "../emitter/EngineEmitter.js";
import { AiBattleSystem } from "../ai/AiBattleSystem.js";
import { AiOpponentSystem } from "../ai/AiOpponentSystem.js";
import type { AiDifficulty, AiSettings } from "../ai/types.js";
import { GameHandler, GameHandlerBuilder } from "../engine/Handler.js";
import { WinningSystem } from "../systems/WinningSystem.js";
import { EmitterSystem } from "../systems/Emitter.js";
import { UiSystem } from "../systems/UiSystem.js";
import { CANONICAL_PLAYABLE_MATCH, createCanonicalPlayableMatchSettings } from "../settings/canonicalPlayableMatch.js";
import { validateGameSettings, type GameSettings } from "../settings/settings.js";
import { buildMapSettings } from "../content/mapCatalog.js";

/** Bounded hard-AI search for browser-responsible KI-vs-KI decisions. */
export const AI_BATTLE_LIMITS = { maxSimulations: 30, maxAngleSamples: 10, maxForceSamples: 3 };

/** Every supported offline match shape; the process and rules are identical. */
export type MatchMode = "hotseat" | "human-vs-ai" | "ai-battle";

/** One config object starts every offline match through the same pipeline. */
export type MatchPipelineConfig = {
	mode: MatchMode;
	mapId: string;
	difficulty?: AiDifficulty;
	seed?: number;
};

/**
 * The single pipeline that starts every offline match. All modes build the
 * same canonical settings, the same systems, the same emitter stack, and the
 * same recorder; only the mode "header" (team names, AI settings, seed, and
 * the input system that drives the match) differs. The seed defaults are
 * stable per mode: the hotseat reference match stays reproducible at 12345
 * (its legacy default) while AI modes draw a fresh seed so every game is new.
 */
export function createMatchHandler(config: MatchPipelineConfig): GameHandler {
	const seed = config.seed ?? (config.mode === "hotseat" ? 12345 : Math.floor(Math.random() * 0x7fffffff));
	const settings = buildMapSettings(config.mapId, createCanonicalPlayableMatchSettings());
	applyModeHeader(settings, config, seed);
	validateGameSettings(settings);
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new WinningSystem(CANONICAL_PLAYABLE_MATCH.teamCount))
		.fromSettings(settings)
		.build();
	const emitters = new CombiEmitter();
	emitters.addEmitter(new GameEmitter(handler, handler.getSettings()?.gameMode, CANONICAL_PLAYABLE_MATCH.teamCount, seed));
	switch (config.mode) {
		case "ai-battle": {
			// One seed per battle, derived seeds per team so the battle is fully
			// reproducible from its recorder.
			const aiSettings: AiSettings[] = [
				{ difficulty: "hard", seed: seed * 2, team: 0, decisionLimits: AI_BATTLE_LIMITS },
				{ difficulty: "hard", seed: seed * 2 + 1, team: 1, decisionLimits: AI_BATTLE_LIMITS },
			];
			// The passive battle input becomes the wrapped gameplay input of the
			// result overlay; clicks are ignored while the battle plays.
			handler.addSystem(new AiBattleSystem(handler, emitters, aiSettings[0], aiSettings[1]));
			handler.setMouseHandler(handler.getSystems().find(system => system instanceof AiBattleSystem) as AiBattleSystem);
			break;
		}
		case "human-vs-ai":
		case "hotseat": {
			const ui = new UiSystem();
			handler.addSystem(ui);
			handler.setMouseHandler(ui);
			handler.addSystem(new EmitterSystem(emitters));
			if (config.mode === "human-vs-ai") {
				const difficulty = config.difficulty ?? "medium";
				const aiSettings: AiSettings = { difficulty, seed, team: 1, ...(difficulty === "hard" ? { decisionLimits: AI_BATTLE_LIMITS } : {}) };
				handler.addSystem(new AiOpponentSystem(handler, emitters, aiSettings));
			}
			break;
		}
	}
	return handler;
}

/** Applies the only mode-specific fields: team/settings headers and AI metadata. */
function applyModeHeader(settings: GameSettings, config: MatchPipelineConfig, seed: number): void {
	if (config.mode !== "human-vs-ai") return;
	const difficulty = config.difficulty ?? "medium";
	settings.myTeam = [0];
	settings.allTeams = ["Human", `${difficulty} KI`];
	settings.ai = { difficulty, seed, team: 1, ...(difficulty === "hard" ? { decisionLimits: AI_BATTLE_LIMITS } : {}) };
}