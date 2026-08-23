import { expect, test } from "bun:test";
import { AiBattleSystem } from "../src/ai/AiBattleSystem.js";
import { AiOpponentSystem } from "../src/ai/AiOpponentSystem.js";
import { GameEmitter } from "../src/emitter/EngineEmitter.js";
import type { CombiEmitter } from "../src/emitter/InputEmitter.js";
import { GameHandler } from "../src/kore/runtime/Handler.js";
import { createMatchHandler } from "../src/scenes/matchPipeline.js";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.js";
import { EmitterSystem } from "../src/systems/Emitter.js";
import { UiSystem } from "../src/systems/UiSystem.js";

function hasSystem(handler: GameHandler, systemClass: abstract new (...args: any[]) => unknown): boolean {
	return handler.getSystems().some(system => system instanceof systemClass);
}

function recorderSeed(handler: GameHandler): number {
	// Hotseat and versus-AI expose the recorder through the EmitterSystem;
	// the ai-battle driver holds the same authoritative emitter directly.
	const emitterSystem = handler.getSystems().find(system => (system as { systemId?: string }).systemId === "core.emitter") as { emitter?: CombiEmitter } | undefined;
	const battleSystem = handler.getSystems().find(system => system instanceof AiBattleSystem) as AiBattleSystem | undefined;
	const emitter = emitterSystem?.emitter ?? battleSystem?.getEmitter();
	const gameEmitter = emitter?.getEmitters().find(item => item instanceof GameEmitter) as GameEmitter | undefined;
	if (!gameEmitter) throw new Error("Missing GameEmitter recorder");
	return gameEmitter.recorder.getReplay().seed;
}

test("every offline mode builds the same canonical match; only the headers differ", () => {
	const canonical = createCanonicalPlayableMatchSettings();
	const hotseat = createMatchHandler({ mode: "hotseat", mapId: "ice-map-v1" });
	const versus = createMatchHandler({ mode: "human-vs-ai", mapId: "ice-map-v1", difficulty: "easy", seed: 7 });
	const battle = createMatchHandler({ mode: "ai-battle", mapId: "ice-map-v1", seed: 9 });

	for (const handler of [hotseat, versus, battle]) {
		const settings = handler.toSettings();
		expect(settings.id).toBe(canonical.id);
		expect(settings.gameMode.id).toBe(canonical.gameMode.id);
		expect(settings.mapBoundarys).toEqual(canonical.mapBoundarys);
	}

	// All three modes hydrate the identical game: players only differ from the
	// raw template because fromSettings adds runtime inventory to each snapshot.
	expect(versus.toSettings().players).toEqual(hotseat.toSettings().players);
	expect(battle.toSettings().players).toEqual(hotseat.toSettings().players);
	expect(battle.toSettings().items).toEqual(hotseat.toSettings().items);

	// Hotseat: both teams human, no AI metadata.
	expect(hotseat.toSettings().myTeam).toEqual(canonical.myTeam);
	const asAny = hotseat.toSettings() as Record<string, unknown>;
	expect("ai" in asAny ? asAny.ai : undefined).toBeUndefined();
	expect(hasSystem(hotseat, UiSystem)).toBe(true);
	expect(hasSystem(hotseat, EmitterSystem)).toBe(true);
	expect(hotseat.getMouseHandler()).toBeInstanceOf(UiSystem);

	// Human vs AI: only the mode header differs from the canonical game.
	const versusSettings = versus.toSettings();
	expect(versusSettings.myTeam).toEqual([0]);
	expect(versusSettings.allTeams).toEqual(["Human", "easy KI"]);
	expect(versusSettings.ai).toMatchObject({ difficulty: "easy", team: 1, seed: 7 });
	expect(hasSystem(versus, AiOpponentSystem)).toBe(true);
	expect(hasSystem(versus, EmitterSystem)).toBe(true);
	expect(versus.getMouseHandler()).toBeInstanceOf(UiSystem);

	// KI vs KI: canonical headers retained, both teams driven by the battle system.
	const battleSettings = battle.toSettings();
	expect(battleSettings.myTeam).toEqual(canonical.myTeam);
	expect(battleSettings.allTeams).toEqual(canonical.allTeams);
	expect(battleSettings.ai).toBeUndefined();
	expect(hasSystem(battle, AiBattleSystem)).toBe(true);
	expect(battle.getMouseHandler()).toBeInstanceOf(AiBattleSystem);
});

test("only Hard human-vs-AI uses the expensive worker decision path", () => {
	const unavailableWorker = {} as any;
	const medium = createMatchHandler({ mode: "human-vs-ai", mapId: "ice-map-v1", difficulty: "medium", seed: 7, aiWorkerHost: unavailableWorker });
	const mediumAi = medium.getSystems().find(system => system instanceof AiOpponentSystem) as AiOpponentSystem;
	expect(mediumAi.isAiThinking()).toBe(false);

	const battle = createMatchHandler({ mode: "ai-battle", mapId: "ice-map-v1", seed: 9, aiWorkerHost: unavailableWorker });
	const battleAi = battle.getSystems().find(system => system instanceof AiBattleSystem) as AiBattleSystem;
	expect(battleAi.isAiThinking()).toBe(false);
});

test("recorder seeds are stable per pipeline config", () => {
	expect(recorderSeed(createMatchHandler({ mode: "hotseat", mapId: "ice-map-v1" }))).toBe(12345);
	expect(recorderSeed(createMatchHandler({ mode: "human-vs-ai", mapId: "ice-map-v1", difficulty: "hard", seed: 42 }))).toBe(42);
	expect(recorderSeed(createMatchHandler({ mode: "ai-battle", mapId: "ice-map-v1", seed: 9 }))).toBe(9);
});