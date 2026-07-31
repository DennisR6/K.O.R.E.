import { describe, expect, test } from "bun:test";
import { AiTurnEmitter } from "../src/ai/aiEmitter.ts";
import { HardAi } from "../src/ai/hardAi.ts";
import type { AiSettings } from "../src/ai/types.ts";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { MatchEndReason } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { WinningSystem, evaluateLastTeamStanding } from "../src/systems/WinningSystem.ts";

/**
 * Cross-system validation 11.7: the winning evaluation must compose with
 * boundary elimination, set the match result exactly once, and survive
 * snapshot restoration.
 */

/** Deterministic arena: the containment rect pushes players up, the near
 * player reaches the top wall first and is eliminated by the boundary. */
function makeArena() {
	const settings = createDefaultGameSettings(2, 1);
	const tiles = {
		trigger: EffectTrigger.Always,
		triggerValue: [],
		type: EffectType.Physics,
		typeValue: { friction: 0.98, linearDrag: 0.05, stopThreshold: 0.15 },
	};
	const move = {
		trigger: EffectTrigger.Always,
		triggerValue: [],
		type: EffectType.Movement,
		typeValue: { deltaTime: 0, x: 0, y: 0 },
	};
	settings.players[0]!.effects = [move, tiles];
	settings.players[1]!.effects = [move, tiles];
	settings.screenResolution = { x: 3000, y: 1600 };
	settings.worldSize = { x: 3000, y: 1600 };
	settings.mapBoundarys = [
		{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 3000, h: 1600, effects: [] },
		{
			type: SHAPE.CIRCLE, x: 1500, y: 1450, r: 80,
			effects: [
				{
					trigger: EffectTrigger.Collision,
					triggerValue: [],
					type: EffectType.ModifySetting,
					typeValue: { operation: SettingOperation.Set, key: "dead", value: true },
				},
			],
		},
	];
	settings.players[0]!.position = { x: 750, y: 500 };
	settings.players[1]!.position = { x: 2250, y: 1100 };
	return settings;
}

const AI_LIMITS = { maxSimulations: 30, maxAngleSamples: 10, maxForceSamples: 3 };

function buildMatch() {
	const settings = makeArena();
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new WinningSystem(2))
		.fromSettings(settings)
		.build();
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 12345);
	const aiTeam0: AiSettings = { difficulty: "hard", seed: 111, team: 0, decisionLimits: AI_LIMITS };
	const aiTeam1: AiSettings = { difficulty: "hard", seed: 222, team: 1, decisionLimits: AI_LIMITS };
	return { handler, emitter, aiTeam0, aiTeam1 };
}

/** Drives an AI match until completion and returns the action count. */
function playToCompletion(match: ReturnType<typeof buildMatch>): number {
	const { handler, emitter, aiTeam0, aiTeam1 } = match;
	let guard = 0;
	while (handler.getState() !== GameState.Game_over && guard < 10_000) {
		const team = handler.getActiveTeam();
		const submitted = new AiTurnEmitter(new HardAi()).executeTurn(
			handler,
			team === 0 ? aiTeam0 : aiTeam1,
			emitter,
		);
		expect(submitted).toBe(true);
		guard++;
		let ticks = 0;
		while (handler.getState() === GameState.Playing && ticks < 10_000) {
			handler.tick();
			ticks++;
		}
		expect(ticks).toBeLessThan(10_000);
	}
	expect(guard).toBeLessThan(10_000);
	return guard;
}

describe("Winning Lifecycle Composition", () => {
	test("boundary elimination composes with winning evaluation", () => {
		const match = buildMatch();
		const { handler } = match;
		playToCompletion(match);

		// Team 0's figure was pushed out of the containment boundary and died;
		// the surviving team 1 figure triggers the last-team-standing result.
		const entities = handler.getEntityManager().getEntities();
		expect(entities[0]!.isDead()).toBe(true);
		expect(entities[1]!.isDead()).toBe(false);
		expect(handler.getState()).toBe(GameState.Game_over);

		const result = handler.getMatchResult();
		expect(result).toBeDefined();
		expect(result?.winnerTeam).toBe(1);
		expect(result?.reason).toBe(MatchEndReason.LastTeamStanding);
		expect(result?.turnNumber).toBe(4);
	});

	test("the match result is set exactly once and never overwritten", () => {
		const match = buildMatch();
		const { handler } = match;
		playToCompletion(match);

		const result = handler.getMatchResult();
		expect(result).toBeDefined();

		// Ticking a completed match must not re-evaluate or mutate the result.
		for (let i = 0; i < 50; i++) handler.tick();
		expect(handler.getState()).toBe(GameState.Game_over);
		expect(handler.getMatchResult()).toEqual(result);

		// A second elimination attempt changes nothing either: the system
		// short-circuits once the state is Game_over.
		const entities = handler.getEntityManager().getEntities();
		entities[1]!.setIsDead(true);
		handler.tick();
		expect(handler.getMatchResult()).toEqual(result);
		expect(handler.getState()).toBe(GameState.Game_over);
	});

	test("the match result survives snapshot restoration", () => {
		const match = buildMatch();
		const { handler } = match;
		playToCompletion(match);

		const snapshot = handler.toSettings();
		expect(snapshot.matchResult).toEqual(handler.getMatchResult());
		expect(snapshot.state).toBe(GameState.Game_over);

		const restored = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings(snapshot)
			.build();

		expect(restored.getMatchResult()).toEqual(handler.getMatchResult());
		expect(restored.getState()).toBe(GameState.Game_over);
		expect(restored.getTurnNumber()).toBe(handler.getTurnNumber());
		expect(restored.getActiveTeam()).toBe(handler.getActiveTeam());
		expect(restored.getEntityManager().serialize()).toEqual(handler.getEntityManager().serialize());

		// Restored completed matches stay completed: further ticks keep the
		// restored result and state stable.
		restored.tick();
		expect(restored.getMatchResult()).toEqual(handler.getMatchResult());
		expect(restored.getState()).toBe(GameState.Game_over);
	});

	test("a mid-match snapshot restores to the same winning lifecycle", () => {
		const match = buildMatch();
		const { handler } = match;
		const actions = playToCompletion(match);
		expect(actions).toBeGreaterThan(2);

		// Replay the first two actions through a fresh handler, snapshot it,
		// restore, and drive the restored match to completion again.
		const settings = makeArena();
		const interrupted = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings(settings)
			.build();
		const interruptedEmitter = new GameEmitter(interrupted, settings.gameMode!, 2, 12345);
		const aiTeam0: AiSettings = { difficulty: "hard", seed: 111, team: 0, decisionLimits: AI_LIMITS };
		const aiTeam1: AiSettings = { difficulty: "hard", seed: 222, team: 1, decisionLimits: AI_LIMITS };
		for (let i = 0; i < 2; i++) {
			const team = interrupted.getActiveTeam();
			new AiTurnEmitter(new HardAi()).executeTurn(
				interrupted,
				team === 0 ? aiTeam0 : aiTeam1,
				interruptedEmitter,
			);
			let ticks = 0;
			while (interrupted.getState() === GameState.Playing && ticks < 10_000) {
				interrupted.tick();
				ticks++;
			}
		}
		expect(interrupted.getMatchResult()).toBeUndefined();

		const restored = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings(interrupted.toSettings())
			.build();

		const restoredEmitter = new GameEmitter(restored, settings.gameMode!, 2, 12345);
		let guard = 0;
		while (restored.getState() !== GameState.Game_over && guard < 10_000) {
			const team = restored.getActiveTeam();
			new AiTurnEmitter(new HardAi()).executeTurn(
				restored,
				team === 0 ? aiTeam0 : aiTeam1,
				restoredEmitter,
			);
			guard++;
			let ticks = 0;
			while (restored.getState() === GameState.Playing && ticks < 10_000) {
				restored.tick();
				ticks++;
			}
		}
		expect(guard).toBeLessThan(10_000);

		// The restored mid-match run ends with the same result as the
		// uninterrupted run.
		expect(restored.getMatchResult()).toEqual(handler.getMatchResult());
		expect(restored.getMatchResult()?.winnerTeam).toBe(1);
		expect(restored.getMatchResult()?.reason).toBe(MatchEndReason.LastTeamStanding);
	});

	test("winning evaluation requires a sole surviving team", () => {
		expect(evaluateLastTeamStanding([], 2)).toBeUndefined();
		expect(evaluateLastTeamStanding([
			{ isDead: () => false, getTeam: () => [0] } as never,
			{ isDead: () => false, getTeam: () => [1] } as never,
		], 2)).toBeUndefined();
		expect(evaluateLastTeamStanding([
			{ isDead: () => true, getTeam: () => [0] } as never,
			{ isDead: () => false, getTeam: () => [1] } as never,
		], 2)).toBe(1);
		expect(evaluateLastTeamStanding([
			{ isDead: () => true, getTeam: () => [0] } as never,
			{ isDead: () => true, getTeam: () => [1] } as never,
		], 2)).toBeUndefined();
		expect(() => evaluateLastTeamStanding([], 0)).toThrow();
	});
});
