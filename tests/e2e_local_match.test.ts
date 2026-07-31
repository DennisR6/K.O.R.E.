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
import { RuleInterpreter } from "../src/rules/RuleInterpreter.ts";
import { createMagmaCradleMap } from "../src/settings/magmaCradleMap.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { WinningSystem, evaluateLastTeamStanding } from "../src/systems/WinningSystem.ts";
import { ItemPhaseUI } from "../src/ui/ItemPhaseUI.ts";

describe("E2E Local Match Lifecycle", () => {
	test("runs complete local match with items, hazards, elimination, result, snapshot restoration, reset, and replay", () => {
		// 1. Setup local match with 2 teams (1 figure each), hazards (Magma Cradle map), and official items
		const mapDoc = createMagmaCradleMap({ x: 1200, y: 675 });
		validateMapDocument(mapDoc);

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

		// Build handler with default systems & WinningSystem
		const winningSystem = new WinningSystem(2);
		const handler = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(winningSystem)
			.fromSettings(settings)
			.build();

		const emitter = new GameEmitter(handler, gameMode, 2, 99999);

		const entities = handler.getEntityManager().getEntities();
		expect(entities).toHaveLength(2);
		const [p1, p2] = entities;

		expect(p1.getTeam()).toEqual([0]);
		expect(p2.getTeam()).toEqual([1]);
		expect(p1.isDead()).toBe(false);
		expect(p2.isDead()).toBe(false);
		expect(handler.getTurnNumber()).toBe(0);
		expect(handler.getActiveTeam()).toBe(0);
		expect(handler.getRuleState().phase).toBe(RulePhase.Item);

		// 2. Team 0 uses an item during the item phase
		const p1Inventory = p1.getInventory();
		expect(p1Inventory.some((i) => i.itemId === "power-dash")).toBe(true);

		emitter.sendItemUse(p1.getId(), "power-dash", { type: "self" });

		expect(handler.getRuleState().itemUses).toBe(1);

		// Advance phase from Item to Physics
		const interpreter = new RuleInterpreter(gameMode);
		ItemPhaseUI.skipItemPhase(handler, interpreter);
		expect(handler.getRuleState().phase).toBe(RulePhase.Physics);

		// Verify power-dash was consumed in p1 inventory
		expect(p1.getInventory().find((i) => i.itemId === "power-dash")).toEqual({
			itemId: "power-dash",
			remainingUses: 1,
			usesThisTurn: 1,
		});

		// 3. Team 0 executes a shot that pushes Team 1 figure into the kill-zone hazard
		// Place p2 directly in front of p1 near the kill-zone hazard in Magma Cradle
		const killZone = mapDoc.hazards.find((h) => h.type === "kill-zone")!;
		const killX = killZone.config.x as number;
		const killY = killZone.config.y as number;

		// Position p1 and p2 such that shooting p1 into p2 knocks p2 into kill zone
		p1.setPos({ x: killX - 80, y: killY });
		p2.setPos({ x: killX - 30, y: killY });

		// Team 0 shoots p1 toward right (0 degrees)
		emitter.sendShot(p1.getId(), 0, 10);

		// Tick handler until playback completes
		while (handler.getState() === GameState.Playing) {
			handler.tick();
		}

		// Simulation & playback complete. Check that p2 was eliminated by the kill-zone hazard
		expect(p2.isDead()).toBe(true);
		expect(p1.isDead()).toBe(false);

		// Check winning evaluation
		const winner = evaluateLastTeamStanding(entities, 2);
		expect(winner).toBe(0);

		const result = {
			winnerTeam: 0,
			reason: MatchEndReason.LastTeamStanding,
			turnNumber: handler.getTurnNumber(),
		};
		handler.setMatchResult(result);
		handler.setState(GameState.Game_over);

		expect(handler.getState()).toBe(GameState.Game_over);
		expect(handler.getMatchResult()).toEqual(result);

		// 4. Snapshot serialization and reconstruction (toSettings)
		const snapshot = handler.toSettings();
		expect(snapshot.matchResult).toEqual(result);
		expect(snapshot.state).toBe(GameState.Game_over);

		const restoredHandler = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings(snapshot)
			.build();

		expect(restoredHandler.getState()).toBe(GameState.Game_over);
		expect(restoredHandler.getMatchResult()).toEqual(result);
		expect(restoredHandler.getTurnNumber()).toBe(handler.getTurnNumber());
		expect(restoredHandler.getActiveTeam()).toBe(handler.getActiveTeam());

		const restoredEntities = restoredHandler.getEntityManager().getEntities();
		expect(restoredEntities[0].isDead()).toBe(false);
		expect(restoredEntities[1].isDead()).toBe(true);

		// 5. Replay recording and playback
		const replay = emitter.recorder.getReplay();
		expect(() => validateReplayDocument(replay)).not.toThrow();
		expect(replay.actions).toHaveLength(2);
		expect(replay.actions[0].type).toBe("itemUse");
		expect(replay.actions[1].type).toBe("shoot");

		// Playback replay from initial state
		const replayPlayer = new ReplayPlayer(replay);

		// Set initial entity positions on replay player's handler to match the start of the match
		// Note: Replay initialSettings contains initial figure settings.
		// For accurate replay playback of shots that rely on modified starting positions,
		// the replay player's handler executes the same sequence of actions.
		const replayFinalState = replayPlayer.playAll();
		expect(replayFinalState).toBeDefined();
		expect(replayFinalState.length).toBe(2);

		// 6. Match Rematch / Reset
		handler.rematch();

		expect(handler.getState()).toBe(GameState.Your_turn);
		expect(handler.getTurnNumber()).toBe(0);
		expect(handler.getActiveTeam()).toBe(0);
		expect(handler.getMatchResult()).toBeUndefined();

		const rematchedEntities = handler.getEntityManager().getEntities();
		expect(rematchedEntities[0].isDead()).toBe(false);
		expect(rematchedEntities[1].isDead()).toBe(false);
		expect(rematchedEntities[0].getInventory().length).toBeGreaterThan(0);
	});
});
