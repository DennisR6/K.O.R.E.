import { CombiEmitter } from "../emitter/InputEmitter.js";
import { GameEmitter } from "../emitter/EngineEmitter.js";
import { RulePhase } from "../rules/types.js";
import { falltuerStructure, falltuerTriggerDefinitions } from "../item/officialItems.js";
import { AiBattleSystem } from "../ai/AiBattleSystem.js";
import { AiOpponentSystem } from "../ai/AiOpponentSystem.js";
import type { AiDifficulty, AiSettings } from "../ai/types.js";
import type { GameHandler } from "../kore/runtime/Handler.js";
import { kore } from "../kore/sdk/index.js";
import { CANONICAL_PLAYABLE_MATCH, createCanonicalPlayableMatchSettings } from "../settings/canonicalPlayableMatch.js";
import { buildMapSettings } from "../content/mapCatalog.js";
import { EmitterSystem } from "../systems/Emitter.js";
import { UiSystem } from "../systems/UiSystem.js";
import { applyGameMode } from "../rules/modeCatalog.js";
import type { LoadedContentPackage } from "../content/package.js";
import { loadMapDocument } from "../contracts/documents.js";
import { validateGameSettings } from "../settings/settings.js";
import type { HardAiWorkerHost } from "../ai/worker/host.js";

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
	gameModeId?: string;
	mod?: LoadedContentPackage;
	aiWorkerHost?: HardAiWorkerHost;
	/** Debug-only sandbox override: grants every declared item to both teams. */
	allItemsOverride?: boolean;
};

/**
 * The single pipeline that starts every offline match. Canonical match
 * authoring (settings header, game mode, teams, engine system profile, and
 * seed) flows through the KORE match SDK, and the runtime handler is built
 * through the engine handler runtime factory. Only the transport adapters
 * (UI, emitters, and AI drivers) remain application-owned.
 */
export function createMatchHandler(config: MatchPipelineConfig): GameHandler {
	const seed = config.seed ?? (config.mode === "hotseat" ? 12345 : Math.floor(Math.random() * 0x7fffffff));
	const baseSettings = createCanonicalPlayableMatchSettings();
	const modMap = config.mod?.package.maps?.[0];
	const settings = modMap ? loadMapDocument(modMap, baseSettings) : buildMapSettings(config.mapId, baseSettings);
	// Falltür needs its dormant canonical slot on every playable map before its
	// position trigger can activate it.
	if (settings.items?.some(item => item.id === "falltuer")) {
		if (!settings.mapBoundarys.some(boundary => boundary.id === falltuerStructure.id)) settings.mapBoundarys.push(structuredClone(falltuerStructure));
		const existingTriggerIds = new Set((settings.triggerDefinitions ?? []).map(definition => definition.id));
		settings.triggerDefinitions = [...(settings.triggerDefinitions ?? []), ...falltuerTriggerDefinitions.filter(definition => !existingTriggerIds.has(definition.id)).map(definition => structuredClone(definition))];
	}
	if (config.mod) {
		if (config.mod.package.items) settings.items = structuredClone(config.mod.package.items);
		const modMode = config.mod.package.modes?.[0];
		if (modMode) settings.gameMode = kore.createGameMode(modMode);
	} else if (config.gameModeId) applyGameMode(settings, config.gameModeId);
	if (config.allItemsOverride) {
		const uses = settings.items?.map(item => ({ itemId: item.id, uses: 2 })) ?? [];
		settings.gameMode = kore.createGameMode({
			...settings.gameMode!,
			id: "debug-item-sandbox",
			phases: [RulePhase.Item, RulePhase.Physics],
			maxItemsPerTurn: 1,
			itemEconomy: { fixedLoadouts: [{ team: 0, items: uses }, { team: 1, items: uses }], mapPickups: [] },
		});
	}
	validateGameSettings(settings);
	const difficulty = config.difficulty ?? "medium";
	const header = config.mode === "human-vs-ai"
		? { myTeam: [0] as number[], allTeams: ["Human", `${difficulty} KI`], ai: kore.ai.createSettings({ difficulty, seed, team: 1, ...(difficulty === "hard" ? { decisionLimits: AI_BATTLE_LIMITS } : {}) }) }
		: { myTeam: settings.myTeam, allTeams: settings.allTeams };
	const definition = kore.createMatchDefinition({ mapId: config.mapId, settings, gameMode: settings.gameMode!, seed, header });
	const handler = kore.createRuntimeMatch(definition);
	// The worker computes HardAi decisions. Passing it to Easy/Medium or the
	// intentionally cheap AI-vs-AI spectator mode makes those turns wait for a
	// much larger search than the configured producer actually needs.
	const hardAiWorkerHost = config.mode === "human-vs-ai" && difficulty === "hard" ? config.aiWorkerHost : undefined;
	hardAiWorkerHost?.attachHandler(handler);
	const emitters = new CombiEmitter();
	const gameEmitter = new GameEmitter(handler, handler.getSettings()?.gameMode, CANONICAL_PLAYABLE_MATCH.teamCount, seed, hardAiWorkerHost);
	emitters.addEmitter(gameEmitter);
	switch (config.mode) {
		case "ai-battle": {
			// One seed per battle, derived seeds per team so the battle is fully
			// reproducible from its recorder.
			// Spectator battles prioritize stable turn cadence over speculative
			// search. Easy AI remains a real deterministic producer while avoiding
			// multi-second hard-AI decision pauses between turns.
			const aiSettings: AiSettings[] = [
				kore.ai.createSettings({ difficulty: "easy", seed: seed * 2, team: 0 }),
				kore.ai.createSettings({ difficulty: "easy", seed: seed * 2 + 1, team: 1 }),
			];
			// AI-vs-AI deliberately uses Easy producers; do not precompute them
			// through the HardAi worker.
			gameEmitter.setAiWorkerSettings([]);
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
				const aiSettings: AiSettings = kore.ai.createSettings({ difficulty, seed, team: 1, ...(difficulty === "hard" ? { decisionLimits: AI_BATTLE_LIMITS } : {}) });
				gameEmitter.setAiWorkerSettings(hardAiWorkerHost ? [aiSettings] : []);
				handler.addSystem(new AiOpponentSystem(handler, emitters, aiSettings, hardAiWorkerHost));
			}
			break;
		}
	}
	return handler;
}

/** Starts a local all-items item sandbox for browser/debug tooling. */
export function createDebugItemSandboxHandler(mapId = "ice-map-v1"): GameHandler {
	return createMatchHandler({ mode: "hotseat", mapId, allItemsOverride: true });
}
