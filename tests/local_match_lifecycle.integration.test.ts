import { describe, expect, test } from "bun:test";
import { loadMapDocument, validateMapDocument } from "../src/contracts/documents.ts";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import {
	ankerItem,
	falltuerItem,
	freezeShotItem,
	powerDashItem,
	switchItem,
} from "../src/item/officialItems.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { validateReplayDocument } from "../src/replay/types.ts";
import { MatchEndReason, RulePhase, type GameModeSettings } from "../src/rules/types.ts";
import { createMagmaCradleMap } from "../src/settings/magmaCradleMap.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { WinningSystem } from "../src/systems/WinningSystem.ts";

describe("Local Match Lifecycle Integration", () => {
	test("runs complete local match with items, hazards, elimination, result, snapshot restoration, reset, and replay purely via engine APIs", () => {
		// 1. Load and validate map document
		const mapDoc = createMagmaCradleMap({ x: 1200, y: 675 });
		validateMapDocument(mapDoc);

		const killZone = mapDoc.hazards.find((h) => h.id === "north-lava")!;
		const killX = killZone.config.x as number;
		const killY = killZone.config.y as number;

		// 2. Initialize base settings and load map document
		const baseSettings = createDefaultGameSettings(2, 1);
		baseSettings.screenResolution = { x: 800, y: 450 };
		baseSettings.items = [powerDashItem, ankerItem, falltuerItem, freezeShotItem, switchItem];

		const gameMode: GameModeSettings = {
			phases: [RulePhase.Item, RulePhase.Physics],
			maxItemsPerTurn: 1,
			itemEconomy: {
				fixedLoadouts: [
					{
						team: 0,
						items: [
							{ itemId: "power-dash", uses: 2 },
							{ itemId: "falltuer", uses: 1 },
						],
					},
					{ team: 1, items: [{ itemId: "anker", uses: 1 }] },
				],
				mapPickups: [],
			},
		};
		baseSettings.gameMode = gameMode;

		const settings = loadMapDocument(mapDoc, baseSettings);

		// 3. Configure initial positions for replayable hazard elimination BEFORE building handler or recorder
		// Position p1 and p2 below north-lava so shooting p1 upwards (270°) knocks p2 into north-lava
		settings.players[0].position = { x: killX, y: killY + 110 };
		settings.players[1].position = { x: killX, y: killY + 50 };

		// 4. Build handler with default systems & WinningSystem
		const winningSystem = new WinningSystem(2);
		const handler = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(winningSystem)
			.fromSettings(settings)
			.build();

		// 5. Construct GameEmitter (which records initialSettings into replay recorder)
		const emitter = new GameEmitter(handler, gameMode, 2, 99999);

		const entities = handler.getEntityManager().getEntities();
		expect(entities).toHaveLength(2);
		const [p1, p2] = entities;

		expect(p1.getTeam()).toEqual([0]);
		expect(p2.getTeam()).toEqual([1]);
		expect(p1.isDead()).toBe(false);
		expect(p2.isDead()).toBe(false);
		expect(p1.getPos()).toEqual({ x: killX, y: killY + 110 });
		expect(p2.getPos()).toEqual({ x: killX, y: killY + 50 });
		expect(handler.getTurnNumber()).toBe(0);
		expect(handler.getActiveTeam()).toBe(0);
		expect(handler.getRuleState().phase).toBe(RulePhase.Item);

		// 6. Team 0 uses an item via the emitter/handler API during the item phase
		const p1Inventory = p1.getInventory();
		expect(p1Inventory.some((i) => i.itemId === "power-dash")).toBe(true);

		emitter.sendItemUse(p1.getId(), "power-dash", { type: "self" });

		expect(handler.getRuleState().itemUses).toBe(1);
		expect(p1.getInventory().find((i) => i.itemId === "power-dash")).toEqual({
			itemId: "power-dash",
			remainingUses: 1,
			usesThisTurn: 1,
		});

		// 7. Advance rule phase from Item to Physics via handler engine API
		handler.skipCurrentPhase();
		expect(handler.getRuleState().phase).toBe(RulePhase.Physics);

		// 8. Team 0 executes a shot via emitter API that knocks Team 1 figure into the kill-zone hazard
		emitter.sendShot(p1.getId(), 270, 8);

		// 9. Tick handler until playback and physics settle (with safety tick limit)
		const maxTicks = 10_000;
		let ticks = 0;

		while (handler.getState() === GameState.Playing && ticks < maxTicks) {
			handler.tick();
			ticks++;
		}

		expect(ticks).toBeGreaterThan(0);
		expect(ticks).toBeLessThan(maxTicks);

		// 10. Verify hazard elimination and automatic WinningSystem completion
		expect(p2.isDead()).toBe(true);
		expect(p1.isDead()).toBe(false);

		expect(handler.getState()).toBe(GameState.Game_over);
		const result = handler.getMatchResult();
		expect(result).toBeDefined();
		expect(result?.winnerTeam).toBe(0);
		expect(result?.reason).toBe(MatchEndReason.LastTeamStanding);
		expect(result?.turnNumber).toBe(0);

		// 11. Snapshot serialization and reconstruction (toSettings)
		const snapshot = handler.toSettings();
		expect(snapshot.matchResult).toEqual(result);
		expect(snapshot.state).toBe(GameState.Game_over);

		const restoredHandler = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings(snapshot)
			.build();

		expect(restoredHandler.getState()).toBe(handler.getState());
		expect(restoredHandler.getMatchResult()).toEqual(handler.getMatchResult());
		expect(restoredHandler.getTurnNumber()).toBe(handler.getTurnNumber());
		expect(restoredHandler.getActiveTeam()).toBe(handler.getActiveTeam());

		const restoredEntities = restoredHandler.getEntityManager().getEntities();
		expect(restoredEntities).toHaveLength(entities.length);
		for (let i = 0; i < entities.length; i++) {
			expect(restoredEntities[i].getTeam()).toEqual(entities[i].getTeam());
			expect(restoredEntities[i].isDead()).toBe(entities[i].isDead());
			expect(restoredEntities[i].getPos()).toEqual(entities[i].getPos());
			expect(restoredEntities[i].getVel()).toEqual(entities[i].getVel());
			expect(restoredEntities[i].getInventory()).toEqual(entities[i].getInventory());
		}

		// 12. Replay recording and full end-state playback verification
		const replay = emitter.recorder.getReplay();
		expect(() => validateReplayDocument(replay)).not.toThrow();
		expect(replay.actions).toHaveLength(2);
		expect(replay.actions[0].type).toBe("itemUse");
		expect(replay.actions[1].type).toBe("shoot");

		const replayPlayer = new ReplayPlayer(replay);
		replayPlayer.playAll();

		const replayHandler = replayPlayer.getHandler();

		expect(replayHandler.getState()).toBe(handler.getState());
		expect(replayHandler.getMatchResult()).toEqual(handler.getMatchResult());
		expect(replayHandler.getTurnNumber()).toBe(handler.getTurnNumber());
		expect(replayHandler.getActiveTeam()).toBe(handler.getActiveTeam());

		const replayEntities = replayHandler.getEntityManager().getEntities();
		expect(replayEntities).toHaveLength(entities.length);
		for (let i = 0; i < entities.length; i++) {
			expect(replayEntities[i].getTeam()).toEqual(entities[i].getTeam());
			expect(replayEntities[i].isDead()).toBe(entities[i].isDead());
			expect(replayEntities[i].getPos()).toEqual(entities[i].getPos());
			expect(replayEntities[i].getVel()).toEqual(entities[i].getVel());
			expect(replayEntities[i].getInventory()).toEqual(entities[i].getInventory());
		}

		// 13. Match Rematch / Reset via handler.rematch()
		handler.rematch();

		expect(handler.getState()).toBe(GameState.Your_turn);
		expect(handler.getTurnNumber()).toBe(0);
		expect(handler.getActiveTeam()).toBe(0);
		expect(handler.getMatchResult()).toBeUndefined();
		expect(handler.getRuleState().phase).toBe(RulePhase.Item);

		const rematchedEntities = handler.getEntityManager().getEntities();
		expect(rematchedEntities).toHaveLength(2);
		expect(rematchedEntities[0].isDead()).toBe(false);
		expect(rematchedEntities[1].isDead()).toBe(false);

		expect(rematchedEntities[0].getPos()).toEqual(settings.players[0].position);
		expect(rematchedEntities[1].getPos()).toEqual(settings.players[1].position);

		expect(rematchedEntities[0].getVel()).toEqual({ x: 0, y: 0 });
		expect(rematchedEntities[1].getVel()).toEqual({ x: 0, y: 0 });

		expect(rematchedEntities[0].getInventory()).toEqual([
			{ itemId: "power-dash", remainingUses: 2, usesThisTurn: 0 },
			{ itemId: "falltuer", remainingUses: 1, usesThisTurn: 0 },
		]);
		expect(rematchedEntities[1].getInventory()).toEqual([
			{ itemId: "anker", remainingUses: 1, usesThisTurn: 0 },
		]);
	});
});
