import { describe, expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { GameState } from "../src/kore/runtime/types.ts";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { MatchEndReason, MatchStatus, RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { evaluateLastTeamStanding, WinningSystem } from "../src/systems/WinningSystem.ts";

/**
 * Task 12.7 - Model Explicit Match Status Results.
 *
 * Proves that match outcomes are classified by an explicit status value
 * (`ongoing` | `winner` | `draw`) and that a draw never invents a fake team
 * ID: `MatchResult.winnerTeam` is `null` for draws and consumers are never
 * forced to infer the outcome from the winner team or the reason alone.
 */

function arena(players: { x: number; y: number }[], killCircles: { x: number; y: number; r: number }[], gameMode: GameModeSettings) {
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
		...killCircles.map(circle => ({
			type: SHAPE.CIRCLE,
			x: circle.x,
			y: circle.y,
			r: circle.r,
				effects: [{ trigger: EffectTrigger.Collision, triggerValue: [], type: EffectType.Multi, typeValue: [
					{ type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "physicsEnabled", value: false } },
					{ type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "drawingEnabled", value: false } },
				] }],
		})),
	];
	settings.players[0]!.position = players[0]!;
	settings.players[1]!.position = players[1]!;
	settings.items = [];
	settings.gameMode = gameMode;
	const handler = new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(settings).build();
	const emitter = new GameEmitter(handler, gameMode, 2, 12345);
	return { handler, emitter };
}

function settle(handler: ReturnType<typeof arena>["handler"]) {
	let guard = 0;
	while (handler.getState() === GameState.Playing && guard < 10_000) {
		handler.tick();
		guard++;
	}
	return guard;
}

const physicsMode: GameModeSettings = {
	id: "status-model",
	phases: [RulePhase.Physics],
	maxItemsPerTurn: 0,
	winCondition: WinCondition.LastTeamStanding,
	itemEconomy: { fixedLoadouts: [], mapPickups: [] },
};

describe("match status model", () => {
	test("evaluator explicitly discriminates ongoing, winner, and draw outcomes", () => {
		const alive0 = { isDead: () => false, getTeam: () => [0] } as never;
		const alive1 = { isDead: () => false, getTeam: () => [1] } as never;
		const dead0 = { isDead: () => true, getTeam: () => [0] } as never;
		const dead1 = { isDead: () => true, getTeam: () => [1] } as never;

		// No terminal outcome while two or more teams still have living figures.
		expect(evaluateLastTeamStanding([alive0, alive1], 2)).toEqual({ status: MatchStatus.Ongoing });
		expect(evaluateLastTeamStanding([], 2)).toEqual({ status: MatchStatus.Draw });

		// Exactly one living team is a winner with the real team id.
		expect(evaluateLastTeamStanding([alive0, dead1], 2)).toEqual({ status: MatchStatus.Winner, winnerTeam: 0 });

		// Zero living teams is a draw, and never invents a team id.
		expect(evaluateLastTeamStanding([dead0, dead1], 2)).toEqual({ status: MatchStatus.Draw });

		// Unknown or out-of-range teams are ignored, not counted.
		expect(evaluateLastTeamStanding([alive0, { isDead: () => false, getTeam: () => [99] } as never], 2)).toEqual({ status: MatchStatus.Winner, winnerTeam: 0 });

		expect(() => evaluateLastTeamStanding([], 0)).toThrow("at least one team");
	});

	test("an ongoing match has no stored result yet", () => {
		const { handler } = arena(
			[{ x: 750, y: 365 }, { x: 2250, y: 1100 }],
			[{ x: 1500, y: 1450, r: 80 }],
			physicsMode,
		);

		expect(handler.getMatchResult()).toBeUndefined();
		expect(handler.getState()).not.toBe(GameState.Game_over);
	});

	test("a last-team-standing win is stored with explicit Winner status and the real team id", () => {
		const { handler, emitter } = arena(
			[{ x: 750, y: 365 }, { x: 1500, y: 1400 }],
			[{ x: 1500, y: 1450, r: 80 }],
			physicsMode,
		);
		const entities = handler.getEntityManager().getEntities();

		emitter.sendShot(entities[0]!.getId(), 300, 8);
		const ticks = settle(handler);
		expect(ticks).toBeLessThan(10_000);

		const result = handler.getMatchResult();
		expect(handler.getState()).toBe(GameState.Game_over);
		expect(result).toEqual({
			status: MatchStatus.Winner,
			winnerTeam: 0,
			reason: MatchEndReason.LastTeamStanding,
			turnNumber: 0,
		});
		// The status is the only thing consumers need to branch on.
		expect(result?.status).toBe(MatchStatus.Winner);
		expect(result?.winnerTeam).toBe(0);

		// The explicit status survives a full snapshot round trip.
		const restored = new GameHandlerBuilder().defaultSystems().fromSettings(handler.toSettings()).build();
		expect(restored.getState()).toBe(GameState.Game_over);
		expect(restored.getMatchResult()).toEqual(result);
	});

	test("a simultaneous elimination is stored as a draw with a null winner team", () => {
		// Team 1 spawns inside a kill circle and dies on frame 1; team 0 shoots
		// straight down into a second kill circle and dies later in the same
		// turn - so zero teams survive and the pending evaluation must be
		// re-evaluated to a draw before the result is finalized.
		const { handler, emitter } = arena(
			[{ x: 750, y: 365 }, { x: 2250, y: 1040 }],
			[
				{ x: 750, y: 530, r: 80 },
				{ x: 2250, y: 1100, r: 80 },
			],
			physicsMode,
		);
		const entities = handler.getEntityManager().getEntities();

		emitter.sendShot(entities[0]!.getId(), 90, 8);
		const ticks = settle(handler);
		expect(ticks).toBeLessThan(10_000);

		const result = handler.getMatchResult();
		expect(handler.getState()).toBe(GameState.Game_over);
		expect(entities[0]!.isDead()).toBe(true);
		expect(entities[1]!.isDead()).toBe(true);
		expect(result).toEqual({
			status: MatchStatus.Draw,
			winnerTeam: null,
			reason: MatchEndReason.Draw,
			turnNumber: 0,
		});
		// No fake winner id is invented for the draw.
		expect(result?.status).toBe(MatchStatus.Draw);
		expect(result?.winnerTeam).toBeNull();

		// The draw result survives a full snapshot round trip.
		const restored = new GameHandlerBuilder().defaultSystems().fromSettings(handler.toSettings()).build();
		expect(restored.getState()).toBe(GameState.Game_over);
		expect(restored.getMatchResult()).toEqual(result);
	});
});
