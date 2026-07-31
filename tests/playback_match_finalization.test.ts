import { describe, expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { MatchEndReason } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { WinningSystem } from "../src/systems/WinningSystem.ts";

/**
 * Task 12.5 - Complete Accepted Turns Before Match Finalization.
 *
 * A winner detected during active playback (mid-turn elimination) must not
 * cancel playback, skip the final sync, or expose a partial completed-match
 * snapshot: the win stays pending, the playback runs its full authoritative
 * frame count, the final sync applies, and only then does the match
 * finalize - without advancing the rule state afterwards.
 */

function killCircleArena() {
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
		{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 3000, h: 1600, effects: [], role: "both" },
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
	settings.players[0]!.position = { x: 750, y: 365 };
	// Player 2 spawns inside the kill circle: eliminated at the first
	// physics frame while player 1's turn still plays out for many frames.
	settings.players[1]!.position = { x: 1500, y: 1450 };
	return settings;
}

describe("playback match finalization", () => {
	test("a mid-playback elimination completes the accepted turn before finalizing", () => {
		const settings = killCircleArena();
		const handler = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings(settings)
			.build();
		const entities = handler.getEntityManager().getEntities();
		const emitter = new GameEmitter(handler, settings.gameMode!, 2, 12345);

		const shot = { angle: 300, power: 8 };
		const expected = handler.simulateTurn(entities[0]!.getId(), shot.angle, shot.power);
		expect(expected.durationFrames).toBeGreaterThan(10);

		emitter.sendShot(entities[0]!.getId(), shot.angle, shot.power);

		// During playback no partial completed-match snapshot is exposed.
		expect(handler.getState()).toBe(GameState.Playing);
		expect(handler.getMatchResult()).toBeUndefined();

		// Halfway through the playback the win is still pending.
		for (let i = 0; i < Math.floor(expected.durationFrames / 2); i++) handler.tick();
		expect(handler.getState()).toBe(GameState.Playing);
		expect(handler.getMatchResult()).toBeUndefined();

		// The playback runs its full authoritative frame count.
		let ticks = Math.floor(expected.durationFrames / 2);
		while (handler.getState() === GameState.Playing && ticks < 10_000) {
			handler.tick();
			ticks++;
		}
		expect(ticks).toBe(expected.durationFrames);

		// The final sync applied the authoritative final state.
		expect(handler.getState()).toBe(GameState.Game_over);
		const live = handler.getEntityManager().getEntities();
		for (let i = 0; i < live.length; i++) {
			expect(live[i]!.getPos()).toEqual(expected.finalState[i]!.position);
			expect(live[i]!.isDead()).toBe(expected.finalState[i]!.isDead);
		}
		expect(live[0]!.isDead()).toBe(false);
		expect(live[1]!.isDead()).toBe(true);

		// The result records the accepted turn that decided the match, and
		// the rule state was NOT advanced past it.
		const result = handler.getMatchResult();
		expect(result).toEqual({
			winnerTeam: 0,
			reason: MatchEndReason.LastTeamStanding,
			turnNumber: 0,
		});
		expect(handler.getTurnNumber()).toBe(0);
		expect(handler.getActiveTeam()).toBe(0);
	});

	test("the completed-match snapshot is complete and stable", () => {
		const settings = killCircleArena();
		const handler = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings(settings)
			.build();
		const entities = handler.getEntityManager().getEntities();
		const emitter = new GameEmitter(handler, settings.gameMode!, 2, 12345);
		const expected = handler.simulateTurn(entities[0]!.getId(), 300, 8);

		emitter.sendShot(entities[0]!.getId(), 300, 8);
		while (handler.getState() === GameState.Playing) handler.tick();

		const snapshot = handler.toSettings();
		expect(snapshot.state).toBe(GameState.Game_over);
		expect(snapshot.matchResult).toEqual(handler.getMatchResult());
		expect(snapshot.turnNumber).toBe(0);
		for (let i = 0; i < snapshot.players.length; i++) {
			expect(snapshot.players[i]!.position).toEqual(expected.finalState[i]!.position);
		}

		// A completed match stays completed: further ticks do not re-evaluate
		// the result or leave the terminal state. (Physics resolution after
		// completion is frozen by a later hardening task; the snapshot taken
		// at completion is already complete and authoritative.)
		const result = handler.getMatchResult();
		for (let i = 0; i < 20; i++) handler.tick();
		expect(handler.getState()).toBe(GameState.Game_over);
		expect(handler.getMatchResult()).toEqual(result);
		expect(handler.getMatchResult()?.turnNumber).toBe(0);
	});

	test("a non-winning accepted turn still advances the rule state normally", () => {
		const settings = killCircleArena();
		// No kill at spawn: both players stay alive for this shot.
		settings.players[1]!.position = { x: 2600, y: 1200 };
		const handler = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings(settings)
			.build();
		const entities = handler.getEntityManager().getEntities();
		const emitter = new GameEmitter(handler, settings.gameMode!, 2, 12345);

		const expected = handler.simulateTurn(entities[0]!.getId(), 300, 4);
		emitter.sendShot(entities[0]!.getId(), 300, 4);

		let ticks = 0;
		while (handler.getState() === GameState.Playing && ticks < 10_000) {
			handler.tick();
			ticks++;
		}
		expect(ticks).toBe(expected.durationFrames);
		expect(handler.getState()).not.toBe(GameState.Playing);
		expect(handler.getMatchResult()).toBeUndefined();
		// The accepted turn completed and the next turn started normally.
		expect(handler.getTurnNumber()).toBe(1);
		expect(handler.getActiveTeam()).toBe(1);
		expect(handler.getEntityManager().getEntities()[0]!.getPos()).toEqual(expected.finalState[0]!.position);
	});
});
