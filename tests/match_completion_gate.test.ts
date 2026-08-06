import { describe, expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { MatchStatus, RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { WinningSystem } from "../src/systems/WinningSystem.ts";

/**
 * Task 12.8 - Freeze Gameplay After Final Match Completion.
 *
 * Once the accepted final turn has completed, its authoritative final state
 * has been synchronized, and the match result has been stored, every later
 * gameplay tick must be a no-op: no entity, effect, structure, system, rule,
 * inventory, or outcome state may be mutated. `rematch()` is the only
 * sanctioned way to resume gameplay.
 */

function completedMatch(spawnInCircle: boolean) {
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
		{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 3000, h: 1600, effects: [], role: "containment" },
		{
			// Either the enemy spawns inside this circle (instant win for
			// team 0), or the shooter slides into it (instant win for team 1).
			type: SHAPE.CIRCLE,
			x: 750,
			y: 530,
			r: 80,
			effects: [
				{ trigger: EffectTrigger.Collision, triggerValue: [], type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "dead", value: true } },
			],
		},
	];
	// Player 2 spawns inside the kill circle, off its exact center, so the
	// deadly collision triggers on the first physics frame.
	settings.players[0]!.position = { x: 750, y: 365 };
	settings.players[1]!.position = spawnInCircle ? { x: 750, y: 500 } : { x: 2250, y: 1100 };
	settings.items = [];
	const gameMode: GameModeSettings = {
		id: "completion-gate",
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

/** Runs the accepted turn and settles until the match completes. */
function finish(handler: ReturnType<typeof completedMatch>["handler"], emitter: ReturnType<typeof completedMatch>["emitter"], shot: { angle: number; power: number }) {
	const entities = handler.getEntityManager().getEntities();
	emitter.sendShot(entities[0]!.getId(), shot.angle, shot.power);
	const ticks = settle(handler);
	expect(ticks).toBeLessThan(10_000);
	expect(handler.getState()).toBe(GameState.Game_over);
	expect(handler.getMatchResult()?.status).toBe(MatchStatus.Winner);
}

function settle(handler: ReturnType<typeof completedMatch>["handler"]) {
	let guard = 0;
	while (handler.getState() === GameState.Playing && guard < 10_000) {
		handler.tick();
		guard++;
	}
	return guard;
}

describe("match completion gate", () => {
	test("after final completion every later tick is a no-op", () => {
		const { handler, emitter } = completedMatch(true);
		const entities = handler.getEntityManager().getEntities();

		finish(handler, emitter, { angle: 300, power: 8 });

		// The post-sync interior depenetration used to drift resting players
		// every frame; now the completed match is fully frozen.
		const frozen = handler.toSettings();
		const frozenPositions = entities.map(entity => ({ ...entity.getPos() }));
		const frozenDead = entities.map(entity => entity.isDead());
		for (let i = 0; i < 100; i++) handler.tick();
		expect(handler.toSettings()).toEqual(frozen);
		expect(entities.map(entity => entity.getPos())).toEqual(frozenPositions);
		expect(entities.map(entity => entity.isDead())).toEqual(frozenDead);

		// Rules, inventories, and the outcome are part of the frozen state.
		expect(handler.getRuleState()).toEqual(frozen.ruleState);
		expect(handler.getMatchResult()).toEqual(frozen.matchResult);
		expect(handler.getState()).toBe(GameState.Game_over);
	});

	test("no turn entry point may start gameplay on a completed match", () => {
		const { handler, emitter } = completedMatch(true);
		const entities = handler.getEntityManager().getEntities();

		finish(handler, emitter, { angle: 300, power: 8 });
		const actorId = entities[0]!.getId();

		expect(() => handler.simulateTurn(actorId, 0, 1)).toThrow(/completed match/i);
		expect(() => handler.resolveTurn({ actorId, angle: 0, power: 1 })).toThrow(/completed match/i);
		expect(() => handler.playTurn({ actorId, input: { angle: 0, power: 1 }, durationFrames: 1, finalState: [] })).toThrow(/completed match/i);
		expect(() => handler.applyRawTurn({ actorId, angle: 0, power: 1 })).toThrow(/completed match/i);

		// The frozen snapshot is still intact after every rejected attempt.
		const frozen = handler.toSettings();
		handler.tick();
		expect(handler.toSettings()).toEqual(frozen);
	});

	test("a completed match restores frozen from its snapshot", () => {
		const { handler, emitter } = completedMatch(true);
		finish(handler, emitter, { angle: 300, power: 8 });

		const restored = new GameHandlerBuilder().defaultSystems().fromSettings(handler.toSettings()).build();
		expect(restored.getState()).toBe(GameState.Game_over);
		expect(restored.getMatchResult()).toEqual(handler.getMatchResult());

		const frozen = restored.toSettings();
		for (let i = 0; i < 50; i++) restored.tick();
		expect(restored.toSettings()).toEqual(frozen);
		expect(() => restored.resolveTurn({ actorId: restored.getEntityManager().getEntities()[0]!.getId(), angle: 0, power: 1 })).toThrow(/completed match/i);
	});

	test("rematch is the sanctioned way to resume frozen gameplay", () => {
		// The deciding shot slides the shooter into the kill circle, so the
		// rematched spawns are clear of every hazard and the match can resume.
		const { handler, emitter } = completedMatch(false);
		finish(handler, emitter, { angle: 90, power: 8 });
		expect(handler.getMatchResult()?.winnerTeam).toBe(1);

		handler.rematch();
		expect(handler.getState()).toBe(GameState.Your_turn);
		expect(handler.getMatchResult()).toBeUndefined();

		// The gate is open again: the match is in a playable state, a resting
		// player stays put (no interior squeeze anymore - physics contract
		// 13.2 resolves embedded contacts fully in one call), and a turn
		// resolves and settles normally.
		const actor = handler.getEntityManager().getEntities()[0]!;
		expect(handler.getState()).toBe(GameState.Your_turn);
		const packet = handler.resolveTurn({ actorId: actor.getId(), angle: 0, power: 1 });
		expect(packet.durationFrames).toBeGreaterThan(0);
		let guard = 0;
		while (handler.getState() === GameState.Playing && guard < 10_000) {
			handler.tick();
			guard++;
		}
		expect(guard).toBeLessThan(10_000);
		expect(handler.getEntityManager().getEntities()[0]!.getPos()).not.toEqual({ x: 750, y: 365 });
	});

	test("ongoing matches are not frozen by the gate", () => {
		const { handler, emitter } = completedMatch(true);
		const entities = handler.getEntityManager().getEntities();

		// While still in the active turn the physics is live.
		emitter.sendShot(entities[0]!.getId(), 300, 8);
		handler.tick();
		handler.tick();
		expect(handler.getState()).toBe(GameState.Playing);
		expect(handler.getMatchResult()).toBeUndefined();
		expect(entities[0]!.getPos()).not.toEqual({ x: 750, y: 365 });

		// And an unfinished match still resolves further turns.
		const remaining = settle(handler);
		expect(remaining).toBeLessThan(10_000);
		expect(handler.getState()).toBe(GameState.Game_over);
	});
});
