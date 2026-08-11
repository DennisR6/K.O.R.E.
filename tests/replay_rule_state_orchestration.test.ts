import { describe, expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { GameState } from "../src/kore/runtime/types.ts";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.ts";
import { powerDashItem } from "../src/item/officialItems.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { ReplayRecorder } from "../src/replay/recorder.ts";
import { MatchEndReason, RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { WinningSystem } from "../src/systems/WinningSystem.ts";

/**
 * Task 12.6 - Restore Rule-State Orchestration For Replays.
 *
 * Replay playback must restore and advance turn number, rule phase, item
 * economy, and active-team state exactly as the live match did. The
 * ReplayPlayer drives the GameEmitter (the single authoritative action
 * path) - there is no parallel replay-only rules implementation, so the
 * per-action rule traces of live and replay runs are identical.
 */

function makeItemArena(): ReturnType<typeof createDefaultGameSettings> {
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
		{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 3000, h: 1600, effects: [], role: "containment" },
		{
			type: SHAPE.CIRCLE, x: 1500, y: 1450, r: 80,
			effects: [
				{
					trigger: EffectTrigger.Collision,
					triggerValue: [],
					type: EffectType.Multi,
					typeValue: [
						{ type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "physicsEnabled", value: false } },
						{ type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "drawingEnabled", value: false } },
					],
				},
			],
		},
	];
	settings.players[0]!.position = { x: 750, y: 365 };
	settings.players[1]!.position = { x: 2250, y: 1100 };
	settings.items = [powerDashItem];
	settings.gameMode = {
		id: "replay-orchestration",
		phases: [RulePhase.Item, RulePhase.Physics],
		maxItemsPerTurn: 1,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: {
			fixedLoadouts: [
				{ team: 0, items: [{ itemId: "power-dash", uses: 2 }] },
				{ team: 1, items: [{ itemId: "power-dash", uses: 2 }] },
			],
			mapPickups: [],
		},
	} satisfies GameModeSettings;
	return settings;
}

interface RuleTracePoint {
	turn: number;
	phase: string;
	team: number;
	itemUses: number;
	inventory: Array<{ itemId: string; remainingUses: number }>;
}

function tracePoint(handler: ReturnType<GameHandlerBuilder["build"]>): RuleTracePoint {
	const entities = handler.getEntityManager().getEntities();
	return {
		turn: handler.getTurnNumber(),
		phase: handler.getRuleState().phase,
		team: handler.getActiveTeam(),
		itemUses: handler.getRuleState().itemUses,
		inventory: entities.map(e => ({
			itemId: e.getInventory().find(i => i.itemId === "power-dash")?.itemId ?? "",
			remainingUses: e.getInventory().find(i => i.itemId === "power-dash")?.remainingUses ?? 0,
		})),
	};
}

function settlePlayback(handler: ReturnType<GameHandlerBuilder["build"]>): void {
	let guard = 0;
	while (handler.getState() === GameState.Playing && guard < 10_000) {
		handler.tick();
		guard++;
	}
	expect(guard).toBeLessThan(10_000);
}

/** Drives three full turns (item use + phase skip + shot each) and returns the live trace. */
function runLiveMatch(settings: ReturnType<typeof makeItemArena>): {
	handler: ReturnType<GameHandlerBuilder["build"]>;
	emitter: GameEmitter;
	trace: RuleTracePoint[];
} {
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new WinningSystem(2))
		.fromSettings(settings)
		.build();
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 12345);
	const entities = handler.getEntityManager().getEntities();
	const trace: RuleTracePoint[] = [];

	const turn = (teamIndex: number, angle: number, power: number) => {
		emitter.sendItemUse(entities[teamIndex]!.getId(), "power-dash", { type: "self" });
		trace.push(tracePoint(handler));
		handler.skipCurrentPhase();
		emitter.sendShot(entities[teamIndex]!.getId(), angle, power);
		settlePlayback(handler);
		trace.push(tracePoint(handler));
	};

	turn(0, 30, 6);
	turn(1, 210, 6);
	turn(0, 90, 5);
	return { handler, emitter, trace };
}

describe("replay rule-state orchestration", () => {
	test("item-mode replay advances turn, phase, team, and item economy identically per action", () => {
		const { handler, emitter, trace } = runLiveMatch(makeItemArena());
		expect(trace).toHaveLength(6);
		expect(handler.getState()).not.toBe(GameState.Game_over);

		const replay = new ReplayPlayer(emitter.recorder.getReplay());
		replay.playAll();

		const replayHandler = replay.getHandler();
		const replayEntities = replayHandler.getEntityManager().getEntities();

		// The replay landed on the exact same rule state, turn, and team.
		expect(replayHandler.getTurnNumber()).toBe(handler.getTurnNumber());
		expect(replayHandler.getActiveTeam()).toBe(handler.getActiveTeam());
		expect(replayHandler.getRuleState()).toEqual(handler.getRuleState());
		expect(replayHandler.getState()).toBe(handler.getState());
		expect(replayHandler.getMatchResult()).toBeUndefined();
		expect(replayEntities.map(e => e.getPos())).toEqual(
			handler.getEntityManager().getEntities().map(e => e.getPos()),
		);

		// Full engine snapshot equality: rule state, turn, teams, entities,
		// inventories, and item draw state all match the live match.
		expect(replayHandler.toSettings()).toEqual(handler.toSettings());
	});

	test("per-action rule trace: live and replay advance at the same points", () => {
		const settings = makeItemArena();
		const { handler, emitter, trace } = runLiveMatch(settings);

		// Re-run the same actions through a fresh replay player, tracing at
		// the same per-action points as the live match.
		const replay = new ReplayPlayer(emitter.recorder.getReplay());
		const replayHandler = replay.getHandler();
		const replayTrace: RuleTracePoint[] = [];
		const replayEntities = replayHandler.getEntityManager().getEntities();
		for (const action of emitter.recorder.getReplay().actions) {
			if (action.type === "itemUse") {
				(replay as unknown as { emitter: GameEmitter }).emitter.sendItemUse(action.actorId, action.itemId!, action.target as never);
				replayTrace.push(tracePoint(replayHandler));
			} else {
				replayHandler.skipCurrentPhase();
				(replay as unknown as { emitter: GameEmitter }).emitter.sendShot(action.actorId, action.input!.angle, action.input!.power);
				settlePlayback(replayHandler);
				replayTrace.push(tracePoint(replayHandler));
			}
		}

		expect(replayTrace).toEqual(trace);
		expect(replayEntities.map(e => e.getPos())).toEqual(
			handler.getEntityManager().getEntities().map(e => e.getPos()),
		);
	});

	test("full item-mode match replay ends with the same completed-match state", () => {
		const settings = makeItemArena();
		// Player 2 spawns inside the kill circle (off its exact center): the
		// first shot wins the match.
		settings.players[1]!.position = { x: 1500, y: 1400 };

		const handler = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings(settings)
			.build();
		const emitter = new GameEmitter(handler, settings.gameMode!, 2, 12345);
		const entities = handler.getEntityManager().getEntities();

		emitter.sendItemUse(entities[0]!.getId(), "power-dash", { type: "self" });
		handler.skipCurrentPhase();
		emitter.sendShot(entities[0]!.getId(), 300, 8);
		settlePlayback(handler);

		expect(handler.getState()).toBe(GameState.Game_over);
		expect(handler.getMatchResult()?.winnerTeam).toBe(0);
		expect(handler.getMatchResult()?.reason).toBe(MatchEndReason.LastTeamStanding);
		expect(handler.getMatchResult()?.turnNumber).toBe(0);

		const replay = new ReplayPlayer(emitter.recorder.getReplay());
		replay.playAll();
		const replayHandler = replay.getHandler();

		// The completed replay reproduces the live match state exactly,
		// including the item use, the match result, and the killing turn.
		expect(replayHandler.toSettings()).toEqual(handler.toSettings());
		expect(replayHandler.getMatchResult()).toEqual(handler.getMatchResult());
		expect(replayHandler.getRuleState()).toEqual(handler.getRuleState());
	});

	test("a recording without rule progression still replays through the authoritative path", () => {
		// Recorder-only document (no live match): the replay must be able to
		// drive a physics-phase game without an item phase.
		const settings = createDefaultGameSettings(2, 1);
		const recorder = new ReplayRecorder(settings, 42);
		recorder.recordShoot(settings.players[0]!.id, 300, 2);
		const player = new ReplayPlayer(recorder.getReplay());
		expect(() => player.playAll()).not.toThrow();

		const handler = player.getHandler();
		expect(handler.getTurnNumber()).toBe(1);
		expect(handler.getActiveTeam()).toBe(1);
		expect(handler.getRuleState().phase).toBe(RulePhase.Physics);
	});
});
