import { describe, expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { MatchStatus, RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { evaluateLastTeamStanding, WinningSystem } from "../src/systems/WinningSystem.ts";

/**
 * Task 12.9 - Unify Winner State With The Match Result.
 *
 * `WinningSystem` holds no mutable winner duplicate anymore: the handler's
 * `MatchResult` is the single authoritative outcome state, so the live
 * handler, snapshot restoration, and replay playback always agree.
 */

function winningArena() {
	const settings = createDefaultGameSettings(2, 1);
	const tiles = {
		trigger: EffectTrigger.Always,
		triggerValue: [],
		type: EffectType.Physics,
		typeValue: { friction: 0.98, linearDrag: 0.05, stopThreshold: 0.15 },
	};
	const move = { trigger: EffectTrigger.Always, triggerValue: [], type: EffectType.Movement, typeValue: { deltaTime: 0, x: 0, y: 0 } };
	settings.players[0]!.effects = [move, tiles];
	settings.players[1]!.effects = [move, tiles];
	settings.screenResolution = { x: 3000, y: 1600 };
	settings.worldSize = { x: 3000, y: 1600 };
	settings.mapBoundarys = [
		{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 3000, h: 1600, effects: [], role: "both" },
		{
			type: SHAPE.CIRCLE,
			x: 1500,
			y: 1450,
			r: 80,
			effects: [
				{ trigger: EffectTrigger.Collision, triggerValue: [], type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "dead", value: true } },
			],
		},
	];
	settings.players[0]!.position = { x: 750, y: 365 };
	settings.players[1]!.position = { x: 1500, y: 1450 };
	settings.items = [];
	const gameMode: GameModeSettings = {
		id: "winner-unification",
		phases: [RulePhase.Physics],
		maxItemsPerTurn: 0,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: { fixedLoadouts: [], mapPickups: [] },
	};
	settings.gameMode = gameMode;
	const handler = new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(settings).build();
	const emitter = new GameEmitter(handler, gameMode, 2, 12345);
	return { handler, emitter };
}

function finish(handler: ReturnType<typeof winningArena>["handler"], emitter: ReturnType<typeof winningArena>["emitter"]) {
	const entities = handler.getEntityManager().getEntities();
	emitter.sendShot(entities[0]!.getId(), 300, 8);
	let guard = 0;
	while (handler.getState() === GameState.Playing && guard < 10_000) {
		handler.tick();
		guard++;
	}
	expect(guard).toBeLessThan(10_000);
	expect(handler.getState()).toBe(GameState.Game_over);
}

describe("winner state unification", () => {
	test("the handler's MatchResult is the only winner state", () => {
		const { handler, emitter } = winningArena();
		finish(handler, emitter);

		const result = handler.getMatchResult();
		expect(result?.status).toBe(MatchStatus.Winner);
		expect(result?.winnerTeam).toBe(0);

		// The same outcome the evaluator derives - and it is carried exactly
		// once in the exported snapshot, nested under `matchResult`.
		const entities = handler.getEntityManager().getEntities();
		expect(evaluateLastTeamStanding(entities, 2)).toEqual({ status: MatchStatus.Winner, winnerTeam: 0 });
		const snapshot = handler.toSettings();
		expect(Object.keys(snapshot).some(key => /winner/i.test(key))).toBe(false);
		expect(snapshot.matchResult).toEqual(result);
	});

	test("no outcome state exists while the match is still pending", () => {
		const { handler, emitter } = winningArena();
		const entities = handler.getEntityManager().getEntities();

		// Mid-playback: the deciding turn runs, but nothing is observable yet.
		emitter.sendShot(entities[0]!.getId(), 300, 8);
		handler.tick();
		expect(handler.getState()).toBe(GameState.Playing);
		expect(handler.getMatchResult()).toBeUndefined();
		expect(handler.toSettings().matchResult).toBeUndefined();

		// After the sync the single result appears, recorded at the deciding turn.
		let guard = 0;
		while (handler.getState() === GameState.Playing && guard < 10_000) {
			handler.tick();
			guard++;
		}
		expect(guard).toBeLessThan(10_000);
		expect(handler.getMatchResult()?.turnNumber).toBe(0);
	});

	test("snapshot restoration agrees with the live result", () => {
		const { handler, emitter } = winningArena();
		finish(handler, emitter);
		const result = handler.getMatchResult();

		const restored = new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(handler.toSettings()).build();
		expect(restored.getState()).toBe(GameState.Game_over);
		expect(restored.getMatchResult()).toEqual(result);
		expect(restored.toSettings().matchResult).toEqual(result);
		expect(restored.getEntityManager().serialize()).toEqual(handler.getEntityManager().serialize());
	});

	test("replay playback agrees with the live result", () => {
		const { handler, emitter } = winningArena();
		finish(handler, emitter);
		const result = handler.getMatchResult();

		const replay = new ReplayPlayer(emitter.recorder.getReplay());
		replay.playAll();
		expect(replay.getHandler().getMatchResult()).toEqual(result);
		expect(replay.getHandler().getState()).toBe(GameState.Game_over);
		expect(replay.getHandler().toSettings().matchResult).toEqual(result);
	});

	test("a draw is unified the same way", () => {
		// Team 1 spawns in a kill circle; team 0 slides into a second kill
		// circle in the same turn - both die, the single result is a draw.
		const settings = winningArena().handler.toSettings();
		const arena = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings({
				...settings,
				mapBoundarys: [
					settings.mapBoundarys[0],
					{
						type: SHAPE.CIRCLE,
						x: 750,
						y: 530,
						r: 80,
						effects: [
							{ trigger: EffectTrigger.Collision, triggerValue: [], type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "dead", value: true } },
						],
					},
					{
						type: SHAPE.CIRCLE,
						x: 2250,
						y: 1100,
						r: 80,
						effects: [
							{ trigger: EffectTrigger.Collision, triggerValue: [], type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "dead", value: true } },
						],
					},
				],
				players: [
					{ ...settings.players[0]!, position: { x: 750, y: 365 } },
					{ ...settings.players[1]!, position: { x: 2250, y: 1100 } },
				],
			} as never)
			.build();
		const emitter = new GameEmitter(arena, settings.gameMode as GameModeSettings, 2, 12345);
		const entities = arena.getEntityManager().getEntities();
		emitter.sendShot(entities[0]!.getId(), 90, 8);
		let guard = 0;
		while (arena.getState() === GameState.Playing && guard < 10_000) {
			arena.tick();
			guard++;
		}
		expect(guard).toBeLessThan(10_000);
		expect(arena.getState()).toBe(GameState.Game_over);

		const result = arena.getMatchResult();
		expect(result?.status).toBe(MatchStatus.Draw);
		expect(result?.winnerTeam).toBeNull();
		expect(arena.toSettings().matchResult).toEqual(result);
	});
});
