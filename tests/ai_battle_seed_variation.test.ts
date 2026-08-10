import { describe, expect, test } from "bun:test";
import { AiBattleSystem } from "../src/ai/AiBattleSystem.js";
import type { AiSettings } from "../src/ai/types.js";
import { buildMapSettings } from "../src/content/mapCatalog.js";
import { GameEmitter } from "../src/emitter/EngineEmitter.js";
import { CombiEmitter } from "../src/emitter/InputEmitter.js";
import type { GameHandler } from "../src/engine/Handler.js";
import { GameHandlerBuilder } from "../src/engine/Handler.js";
import { GameState } from "../src/engine/types.js";
import { MatchStatus } from "../src/rules/types.js";
import { CANONICAL_PLAYABLE_MATCH, createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.js";
import { validateGameSettings } from "../src/settings/settings.js";
import { WinningSystem } from "../src/systems/WinningSystem.js";
import { LocalMatchSceneRouter } from "../src/scenes/LocalMatchSceneRouter.js";

const BATTLE_LIMITS = { maxSimulations: 30, maxAngleSamples: 10, maxForceSamples: 3 };

/**
 * Headless KI-vs-KI battle verification with an observable recorder.
 *
 * The battle seed must change the game: `HardAi` resolves equal-scoring
 * candidates deterministically from the seed, and the scene re-draws the seed
 * for every battle start and every battle rematch, so no two battles are the
 * same replay while each seed stays fully reproducible.
 */
function runBattle(seed: number): { shots: string[]; ticks: number; status: MatchStatus | undefined; winnerTeam: number | null } {
	const startedAt = performance.now();
	const settings = buildMapSettings("ice-map-v1", createCanonicalPlayableMatchSettings());
	validateGameSettings(settings);
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new WinningSystem(CANONICAL_PLAYABLE_MATCH.teamCount))
		.fromSettings(settings)
		.build();
	const emitters = new CombiEmitter();
	const local = new GameEmitter(handler, handler.getSettings()?.gameMode, 2, seed);
	emitters.addEmitter(local);
	const aiTeam0: AiSettings = { difficulty: "hard", seed: seed * 2, team: 0, decisionLimits: BATTLE_LIMITS };
	const aiTeam1: AiSettings = { difficulty: "hard", seed: seed * 2 + 1, team: 1, decisionLimits: BATTLE_LIMITS };
	const aiBattle = new AiBattleSystem(handler, emitters, aiTeam0, aiTeam1);
	handler.addSystem(aiBattle);
	handler.setMouseHandler(aiBattle);
	let ticks = 0;
	while (handler.getState() !== GameState.Game_over && ticks < 400_000) {
		handler.tick();
		ticks++;
	}
	const replay = local.recorder.getReplay();
	const shots = replay.actions
		.filter(action => action.type === "shoot")
		.map(action => `${action.actorId.slice(-4)}@${action.input?.angle}:${action.input?.power}`);
	const matchResult = handler.getMatchResult();
	const summary = {
		shots,
		ticks,
		status: matchResult?.status,
		winnerTeam: matchResult?.winnerTeam ?? null,
	};
	if (process.env.AI_DIAGNOSTIC === "1") console.log(JSON.stringify({ seed, totalDurationMs: performance.now() - startedAt, decisionCount: shots.length, candidateSimulationsUpperBound: shots.length * 30, speculativeTicksUpperBound: shots.length * 30 * 300, ticks, status: summary.status }));
	return summary;
}

function tickUntilOver(handler: GameHandler, maxTicks = 400_000): number {
	let ticks = 0;
	while (handler.getState() !== GameState.Game_over && ticks < maxTicks) {
		handler.tick();
		ticks++;
	}
	return ticks;
}

describe("KI vs KI battle seed variation", () => {
	test("different battle seeds produce different games", () => {
		const a = runBattle(100);
		const b = runBattle(200);
		expect(a.shots.length).toBeGreaterThan(0);
		expect(b.shots.length).toBeGreaterThan(0);
		expect(a.shots).not.toEqual(b.shots);
	}, 180_000);

	test("the same battle seed replays the identical game", () => {
		const a = runBattle(4242);
		const b = runBattle(4242);
		expect(a.shots).toEqual(b.shots);
		expect(a.ticks).toBe(b.ticks);
		expect(a.status).toBe(b.status);
		expect(a.winnerTeam).toBe(b.winnerTeam);
	}, 180_000);
});

describe("KI vs KI battle rematch re-seeding", () => {
	test("rematch re-draws the battle seed and starts a fresh game", () => {
		let nextSeed = 0;
		const router = new LocalMatchSceneRouter(undefined, () => (nextSeed += 1000));
		expect(router.startAiBattle()).toBe(true);
		expect(router.getBattleSeed()).toBe(1000);
		const first = router.getHandler();
		expect(tickUntilOver(first)).toBeGreaterThan(0);
		expect(router.isResultVisible()).toBe(true);
		// Press the overlay's Rematch button through the handler mouse chain.
		first.updateMouse(250, 310);
		first.handleMousePressed();
		const second = router.getHandler();
		expect(second).not.toBe(first);
		expect(router.getBattleSeed()).toBe(2000);
		expect(router.getMapId()).toBe("magma-cradle");
		// The fresh battle keeps playing to completion.
		expect(tickUntilOver(second)).toBeGreaterThan(0);
		expect(second.getState()).toBe(GameState.Game_over);
	}, 180_000);

	test("menu action returns to the menu and clears the battle seed", () => {
		let nextSeed = 0;
		const router = new LocalMatchSceneRouter(undefined, () => (nextSeed += 1000));
		expect(router.startAiBattle()).toBe(true);
		const battle = router.getHandler();
		expect(tickUntilOver(battle)).toBeGreaterThan(0);
		// Refresh the result overlay like the browser frame does, then press
		// the overlay's Menu button.
		expect(router.isResultVisible()).toBe(true);
		battle.updateMouse(410, 310);
		battle.handleMousePressed();
		expect(router.getBattleSeed()).toBeUndefined();
		expect(router.getMapId()).toBeNull();
		expect(router.getHandler()).not.toBe(battle);
		expect(router.isLocalMatch()).toBe(false);
	}, 120_000);
});
