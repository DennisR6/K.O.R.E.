import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { WinningSystem } from "../src/systems/WinningSystem.ts";

const users = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];

/**
 * Regression coverage for the live replay-site failure: an operator replay
 * view built from the mutable live snapshot (legacy rows created before
 * immutable origins were persisted) restored actors that were already dead,
 * so the first recorded action was rejected as "Actor ... is not active".
 * The registry and database boundaries must never fabricate a replay origin
 * from live settings and must refuse serving unplayable documents.
 */

function killingArena() {
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
	settings.players[0]!.position = { x: 750, y: 365 };
	// Inside the kill circle (distance 50 < r 80 + radius 12) but not at its
	// exact center, so the deadly collision triggers on the first physics frame.
	settings.players[1]!.position = { x: 1500, y: 1400 };
	settings.mapBoundarys = [
		{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 3000, h: 1600, effects: [], role: "containment" },
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
	settings.items = [];
	const gameMode: GameModeSettings = {
		id: "killing-arena",
		phases: [RulePhase.Physics],
		maxItemsPerTurn: 0,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: { fixedLoadouts: [], mapPickups: [] },
	};
	settings.gameMode = gameMode;
	return settings;
}

function playKillingTurn(registry: GameRegistry, id: string) {
	const record = registry.get(id)!;
	const actorId = record.handler.getEntityManager().getEntities().find(e => e.getTeam().includes(0))!.getId();
	return registry.submitTurn(users[0]!, { actorId, angle: 300, power: 8 });
}

describe("replay origin reproduction", () => {
	test("new-game operator replay restores actors alive and plays to the same result", () => {
		const db = new GameDatabase(":memory:");
		const registry = new GameRegistry(db);
		const settings = killingArena();
		const record = registry.create(settings, users);
		const id = record.id;

		const res = playKillingTurn(registry, id);
		expect(res.ok).toBe(true);
		expect(registry.get(id)!.handler.getState()).toBe(GameState.Game_over);
		expect(registry.get(id)!.handler.getMatchResult()?.winnerTeam).toBe(0);

		// The authoritative registry replay (used by operator views) restores
		// the pristine creation origin and plays every action deterministically.
		const replay = registry.getReplay(id);
		expect(replay).toBeDefined();
		const replayPlayer = new ReplayPlayer(replay!);
		replayPlayer.playAll();
		expect(replayPlayer.getHandler().getState()).toBe(GameState.Game_over);
		expect(replayPlayer.getHandler().getMatchResult()?.winnerTeam).toBe(0);
		db.close();
	});

	test("legacy rows without a stored origin are replay-unavailable, never fabricated from live settings", () => {
		const db = new GameDatabase(":memory:");
		const registry = new GameRegistry(db);
		const record = registry.create(killingArena(), users);
		const res = playKillingTurn(registry, record.id);
		expect(res.ok).toBe(true);
		expect(registry.get(record.id)!.handler.getState()).toBe(GameState.Game_over);

		// Simulate a legacy row: only the mutable final snapshot persists.
		const live = registry.get(record.id)!.handler.toSettings();
		const firstActorId = registry.get(record.id)!.recorder.getReplay().actions[0]!.actorId;
		const legacy = new GameDatabase(":memory:");
		legacy.createGame({ id: "legacy-game", settings: live, users, currentTeam: 0, turnNumber: 0, updatedAt: 1 });
		expect(legacy.loadGame("legacy-game")!.initialSettings).toBeUndefined();

		// No deterministic origin exists, so no replay document is offered.
		expect(legacy.getOperatorReplay("legacy-game")).toBeUndefined();

		// The operator view boundary must reject the unplayable live fallback.
		const unplayable = { schemaVersion: 1, initialSettings: live, seed: 12345, actions: [{ type: "shoot" as const, actorId: firstActorId, input: { angle: 300, power: 8 } }] };
		expect(() => legacy.createOperatorReplayView("legacy-game", unplayable)).toThrow();

		// Replaying that fabricated document is exactly the live-site failure:
		// the first action's actor is already dead in the restored handler, so
		// the viewer now rejects the unplayable origin immediately.
		expect(() => new ReplayPlayer(unplayable as never)).toThrow(/origin/);
		db.close();
		legacy.close();
	});

	test("already-published operator views with an unplayable origin are no longer served", () => {
		const dir = mkdtempSync(join(tmpdir(), "kore-replay-origin-"));
		const path = join(dir, "views.db");

		// Create a legacy-style row whose live settings have a dead actor.
		const seedDb = new GameDatabase(path);
		const handler = new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(killingArena()).build();
		expect(() => handler.getEntityManager().getEntities().find(e => e.getTeam().includes(1))!.setIsDead(true)).not.toThrow();
		const live = handler.toSettings();
		seedDb.createGame({ id: "legacy-game", settings: live, users, currentTeam: 0, turnNumber: 0, updatedAt: 1 });
		seedDb.close();

		// Insert the broken view the deployed server already stored for the
		// reported live URL before origin validation existed.
		const raw = new Database(path);
		const token = "a2e32708ef6448789324e264484360e3";
		const payload = JSON.stringify({ schemaVersion: 1, initialSettings: live, seed: 12345, actions: [] });
		raw.query("INSERT INTO operator_replay_views (token, game_id, replay_json, updated_at) VALUES (?1, ?2, ?3, ?4)").run(token, "legacy-game", payload, 1);
		raw.close();

		const db = new GameDatabase(path);
		expect(db.getPublicOperatorReplayView(token)).toBeUndefined();
		db.close();
	});
});