import { describe, expect, test } from "bun:test";
import { AiTurnEmitter } from "../src/ai/aiEmitter.ts";
import { HardAi } from "../src/ai/hardAi.ts";
import type { AiSettings } from "../src/ai/types.ts";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { ReplayRecorder } from "../src/replay/recorder.ts";
import { validateReplayDocument } from "../src/replay/types.ts";
import { MatchEndReason, RulePhase, WinCondition } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { WinningSystem } from "../src/systems/WinningSystem.ts";

/**
 * Deterministic AI-vs-AI arena: the arena rect is an explicit containment
 * boundary (physics contract 13.2: solid obstacles never embed resting
 * players). The seeded AI shots slide both figures toward the arena center;
 * the kill circle sits on that deterministic convergence path, so the match
 * terminates with a winner.
 */
function makeAiArena() {
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
			type: SHAPE.CIRCLE, x: 1500, y: 730, r: 80,
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
	settings.players[1]!.position = { x: 2250, y: 1100 };
	return settings;
}

const AI_LIMITS = { maxSimulations: 30, maxAngleSamples: 10, maxForceSamples: 3 };

/** Runs one AI-vs-AI match to completion and returns the live artifacts. */
function runAiMatch(matchSeed: number, aiSeed0: number, aiSeed1: number) {
	const settings = makeAiArena();
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new WinningSystem(2))
		.fromSettings(settings)
		.build();
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, matchSeed);
	const aiTeam0: AiSettings = { difficulty: "hard", seed: aiSeed0, team: 0, decisionLimits: AI_LIMITS };
	const aiTeam1: AiSettings = { difficulty: "hard", seed: aiSeed1, team: 1, decisionLimits: AI_LIMITS };
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
		expect(ticks).toBeGreaterThan(0);
		expect(ticks).toBeLessThan(10_000);
	}
	expect(guard).toBeLessThan(10_000);
	return { handler, emitter };
}

describe("AI Match Replay Lifecycle", () => {
	test("runs an AI-vs-AI match to completion and replays it deterministically", () => {
		// --- Live AI-vs-AI match -------------------------------------------------
		const { handler, emitter } = runAiMatch(12345, 111, 222);

		const result = handler.getMatchResult();
		expect(handler.getState()).toBe(GameState.Game_over);
		expect(result).toBeDefined();
		// The deterministic convergence match: team 1's figure reaches the
		// mid-arena kill circle first and team 0 survives.
		expect(result?.winnerTeam).toBe(0);
		expect(result?.reason).toBe(MatchEndReason.LastTeamStanding);
		expect(result?.turnNumber).toBe(30);

		const liveEntities = handler.getEntityManager().getEntities();
		expect(liveEntities[0]!.isDead()).toBe(false);
		expect(liveEntities[1]!.isDead()).toBe(true);

		// The recorded replay is a valid document with one shot per action
		const replay = emitter.recorder.getReplay();
		expect(() => validateReplayDocument(replay)).not.toThrow();
		expect(replay.actions).toHaveLength(31);
		expect(replay.actions.every(action => action.type === "shoot")).toBe(true);

		// --- Deterministic replay: two independent playback runs are identical ----
		const replayA = new ReplayPlayer(replay);
		const replayB = new ReplayPlayer(replay);
		replayA.playAll();
		replayB.playAll();
		expect(replayB.getHandler().toSettings()).toEqual(replayA.getHandler().toSettings());

		// --- The replay reproduces the authoritative simulation chain ---------------
		// The live visual playback can drift from the authoritative sim (the
		// PlaybackSystem hard-syncs at the end of the turn). The replay re-runs
		// the authoritative `resolveTurn` chain from `initialSettings`, so its
		// entity states must match a fresh server-style run of the recorded
		// actions exactly.
		const authoritative = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings(replay.initialSettings)
			.build();
		const perActionFinals: string[] = [];
		for (const action of replay.actions) {
			authoritative.resolveTurn({
				actorId: action.actorId,
				angle: action.input!.angle,
				power: action.input!.power,
			});
			const ents = authoritative.getEntityManager().getEntities();
			perActionFinals.push(ents.map(entity => `${entity.getPos().x.toFixed(6)},${entity.getPos().y.toFixed(6)}`).join("|"));
		}
		expect(authoritative.getEntityManager().serialize()).toEqual(
			replayA.getHandler().getEntityManager().serialize(),
		);

		// --- The replay reproduces the live match exactly, INCLUDING rule state -----
		// The replay drives the same authoritative domain transitions as the
		// live emitter: rule phase, turn number, active team, item economy, and
		// match result match the live match's final engine snapshot.
		expect(replayA.getHandler().toSettings()).toEqual(handler.toSettings());

		// --- The replay reproduces the live match outcome (winner, deaths) ---------
		const replayEntities = replayA.getHandler().getEntityManager().getEntities();
		expect(replayEntities).toHaveLength(2);
		expect(replayEntities[0]!.isDead()).toBe(false);
		expect(replayEntities[1]!.isDead()).toBe(true);
		expect(replayA.getHandler().getState()).toBe(GameState.Game_over);

		const replayResult = replayA.getHandler().getMatchResult();
		expect(replayResult?.winnerTeam).toBe(result?.winnerTeam);
		expect(replayResult?.reason).toBe(result?.reason);
		// The replay advances turns exactly like the live match did.
		expect(replayResult?.turnNumber).toBe(30);
		expect(replayA.getHandler().getTurnNumber()).toBe(handler.getTurnNumber());
		expect(replayA.getHandler().getActiveTeam()).toBe(handler.getActiveTeam());
		expect(replayA.getHandler().getRuleState()).toEqual(handler.getRuleState());
	});

	test("AI-vs-AI matches are deterministic across match seeds", () => {
		const first = runAiMatch(12345, 111, 222);
		const second = runAiMatch(999, 33, 44);

		// Entity IDs are random per settings construction, so compare shot inputs
		// (angle/power), final positions, and the match result instead.
		const firstActions = first.emitter.recorder.getReplay().actions;
		const secondActions = second.emitter.recorder.getReplay().actions;
		expect(secondActions).toHaveLength(firstActions.length);
		expect(secondActions.map(action => action.input)).toEqual(firstActions.map(action => action.input));
		expect(second.handler.getMatchResult()).toEqual(first.handler.getMatchResult());
		const firstEntities = first.handler.getEntityManager().getEntities();
		const secondEntities = second.handler.getEntityManager().getEntities();
		expect(secondEntities.map(entity => entity.getPos())).toEqual(firstEntities.map(entity => entity.getPos()));
		expect(secondEntities.map(entity => entity.isDead())).toEqual(firstEntities.map(entity => entity.isDead()));
	}, 120_000);

	test("rejects malformed replay actions at the document boundary", () => {
		const valid = () => {
			const recorder = new ReplayRecorder(createDefaultGameSettings(2, 1), 42);
			recorder.recordShoot("actor-1", 90, 5);
			return recorder.getReplay();
		};

		expect(() => validateReplayDocument(valid())).not.toThrow();

		const unknownType = valid();
		(unknownType.actions[0] as { type: string }).type = "teleport";
		expect(() => validateReplayDocument(unknownType)).toThrow(/Unknown replay action type/i);

		const missingInput = valid();
		delete (missingInput.actions[0] as { input?: unknown }).input;
		expect(() => validateReplayDocument(missingInput)).toThrow(/require an input object/i);

		const nonFiniteAngle = valid();
		(nonFiniteAngle.actions[0] as { input: { angle: number } }).input.angle = Number.NaN;
		expect(() => validateReplayDocument(nonFiniteAngle)).toThrow(/angle must be a finite number/i);

		const nonFinitePower = valid();
		(nonFinitePower.actions[0] as { input: { power: number } }).input.power = Number.POSITIVE_INFINITY;
		expect(() => validateReplayDocument(nonFinitePower)).toThrow(/power must be a finite number/i);

		const emptyActor = valid();
		emptyActor.actions[0]!.actorId = "";
		expect(() => validateReplayDocument(emptyActor)).toThrow(/non-empty actorId/i);

		const unknownField = valid();
		(unknownField.actions[0] as Record<string, unknown>).extra = 1;
		expect(() => validateReplayDocument(unknownField)).toThrow(/Unknown replay shoot action field/i);

		const itemWithoutId = valid();
		itemWithoutId.actions[0] = { type: "itemUse", actorId: "actor-1", target: { type: "self" } };
		expect(() => validateReplayDocument(itemWithoutId)).toThrow(/non-empty itemId/i);

		const itemWithoutTarget = valid();
		itemWithoutTarget.actions[0] = { type: "itemUse", actorId: "actor-1", itemId: "anker" };
		expect(() => validateReplayDocument(itemWithoutTarget)).toThrow(/require a target object/i);
	});

	test("replay playback no longer silently ignores invalid actions", () => {
		// Structurally valid document whose shot references an unknown actor:
		// construction succeeds, playback must throw instead of skipping.
		const recorder = new ReplayRecorder(createDefaultGameSettings(2, 1), 42);
		recorder.recordShoot("missing-actor", 90, 5);
		const replay = recorder.getReplay();
		expect(() => validateReplayDocument(replay)).not.toThrow();

		const player = new ReplayPlayer(replay);
		expect(() => player.playAll()).toThrow(/Actor missing-actor not found/);

		// An item use for an undeclared item throws as well. The recorder and the
		// player must share one settings object: default player ids are random
		// UUIDs generated per `createDefaultGameSettings()` call. The game mode
		// starts in the item phase so the replay reaches the item validation.
		const itemSettings = createDefaultGameSettings(2, 1);
		itemSettings.gameMode = {
			id: "item-replay",
			phases: [RulePhase.Item, RulePhase.Physics],
			maxItemsPerTurn: 1,
			winCondition: WinCondition.LastTeamStanding,
			itemEconomy: { fixedLoadouts: [], mapPickups: [] },
		};
		const itemRecorder = new ReplayRecorder(itemSettings, 42);
		itemRecorder.recordItemUse(itemSettings.players[0]!.id, "undeclared-item", { type: "self" });
		const itemPlayer = new ReplayPlayer(itemRecorder.getReplay());
		expect(() => itemPlayer.playAll()).toThrow(/not declared for this game/i);
	});
});
