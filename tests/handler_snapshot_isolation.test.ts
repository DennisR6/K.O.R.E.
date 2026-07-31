import { describe, expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.ts";
import { ankerItem, powerDashItem } from "../src/item/officialItems.ts";
import { MatchEndReason, RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

describe("Handler Snapshot Isolation", () => {
	test("round-trips a mid-match engine snapshot and isolates restored state", () => {
		// --- Build a rich, non-default fixture ---------------------------------
		const settings = createDefaultGameSettings(2, 2);
		settings.friction = { friction: 0.98, linearDrag: 0.05, stopThreshold: 0.2 };
		settings.drift = 0.3;
		settings.screenResolution = { x: 900, y: 600 };
		settings.worldSize = { x: 900, y: 600 };
		settings.items = [ankerItem, powerDashItem];
		settings.gameMode = {
			id: "snapshot-isolation",
			phases: [RulePhase.Item, RulePhase.Physics],
			maxItemsPerTurn: 1,
			winCondition: WinCondition.LastTeamStanding,
			itemEconomy: {
				fixedLoadouts: [{ team: 0, items: [{ itemId: "anker", uses: 1 }] }],
				mapPickups: [],
				randomDraw: { seed: 4242, itemIds: ["power-dash"], drawsPerTurn: 1 },
			},
		};
		settings.ai = {
			difficulty: "hard",
			seed: 42,
			team: 0,
			decisionLimits: { maxSimulations: 30, maxAngleSamples: 10, maxForceSamples: 3 },
		};
		// Non-default entity state for every player
		settings.players[0]!.position = { x: 120, y: 140 };
		settings.players[0]!.velocity = { x: 1.5, y: 0 };
		settings.players[0]!.rotation = 45;
		settings.players[0]!.angularVelocity = 0.1;
		settings.players[0]!.hp = 24;
		settings.players[1]!.position = { x: 400, y: 300 };
		settings.players[1]!.velocity = { x: 0, y: -1 };
		settings.players[2]!.position = { x: 700, y: 480 };
		settings.players[2]!.velocity = { x: -2, y: 0.5 };
		settings.players[3]!.position = { x: 500, y: 520 };
		settings.players[3]!.velocity = { x: 0, y: 1.2 };
		settings.players[3]!.isDead = true;
		// A shield with partially consumed capacity (state must survive serialization)
		settings.players[0]!.effects = [
			{
				trigger: EffectTrigger.Collision,
				triggerValue: [],
				type: EffectType.Shield,
				typeValue: { capacity: 5, remainingCapacity: 3 },
			},
		];
		// Handler-level effect
		settings.effects = [
			{
				trigger: EffectTrigger.Always,
				triggerValue: [],
				type: EffectType.ModifySetting,
				typeValue: { operation: SettingOperation.Set, key: "physicsEnabled", value: true },
			},
		];

		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		const entities = handler.getEntityManager().getEntities();
		expect(entities).toHaveLength(4);
		const emitter = new GameEmitter(handler, settings.gameMode, 2, 4242);

		// --- Exercise item + shot flow so rule state, inventories, and the RNG move ---
		emitter.sendItemUse(entities[0]!.getId(), "anker", { type: "self" });
		handler.skipCurrentPhase();
		emitter.sendShot(entities[0]!.getId(), 45, 5);

		let ticks = 0;
		while (handler.getState() === GameState.Playing && ticks < 10_000) {
			handler.tick();
			ticks++;
		}
		expect(ticks).toBeGreaterThan(0);
		expect(ticks).toBeLessThan(10_000);

		// The turn advanced past team 0: the next turn restarts in the item phase
		expect(handler.getTurnNumber()).toBe(1);
		expect(handler.getActiveTeam()).toBe(1);
		expect(handler.getRuleState().phase).toBe(RulePhase.Item);
		expect(handler.getRuleState().itemUses).toBe(0);

		// --- Serialize the mid-match engine -----------------------------------
		const snapshot = handler.toSettings();
		expect(snapshot.state).toBe(handler.getState());
		expect(snapshot.ruleState).toEqual(handler.getRuleState());
		expect(snapshot.turnNumber).toBe(1);
		expect(snapshot.activeTeam).toBe(1);
		expect(snapshot.itemDrawState).toBeDefined();

		// --- Restore and verify semantic equivalence ---------------------------
		const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();

		expect(restored.getTurnNumber()).toBe(1);
		expect(restored.getActiveTeam()).toBe(1);
		expect(restored.getRuleState()).toEqual(handler.getRuleState());
		expect(restored.getState()).toBe(handler.getState());

		// Full structural equality of the complete engine contract
		expect(restored.toSettings()).toEqual(snapshot);

		const restoredEntities = restored.getEntityManager().getEntities();
		expect(restoredEntities).toHaveLength(4);
		for (let i = 0; i < entities.length; i++) {
			expect(restoredEntities[i]!.getPos()).toEqual(entities[i]!.getPos());
			expect(restoredEntities[i]!.getVel()).toEqual(entities[i]!.getVel());
			expect(restoredEntities[i]!.getRotation()).toEqual(entities[i]!.getRotation());
			expect(restoredEntities[i]!.getHP()).toEqual(entities[i]!.getHP());
			expect(restoredEntities[i]!.isDead()).toEqual(entities[i]!.isDead());
			expect(restoredEntities[i]!.getInventory()).toEqual(entities[i]!.getInventory());
		}

		// --- Identity isolation: no shared runtime objects ----------------------
		expect(restored).not.toBe(handler);
		for (let i = 0; i < entities.length; i++) {
			expect(restoredEntities[i]).not.toBe(entities[i]);
		}

		// --- Behavioral equivalence under identical ticks -----------------------
		for (let i = 0; i < 60; i++) {
			handler.tick();
			restored.tick();
		}
		expect(restored.toSettings()).toEqual(handler.toSettings());

		// --- Mutation isolation: mutating the restored handler leaves the original untouched ---
		const pristine = handler.toSettings();
		restoredEntities[0]!.setPos({ x: 1, y: 1 });
		restoredEntities[0]!.setVel({ x: 9, y: 9 });
		restored.resolveTurn({ actorId: entities[0]!.getId(), angle: 180, power: 3 });
		expect(restored.getEntityManager().getEntities()[0]!.getPos()).not.toEqual(pristine.players[0]!.position);
		expect(handler.toSettings()).toEqual(pristine);

		// --- Mutation isolation: mutating the original leaves the restored handler untouched ---
		const restoredState = restored.toSettings();
		entities[0]!.setPos({ x: 800, y: 500 });
		handler.resolveTurn({ actorId: entities[1]!.getId(), angle: 0, power: 4 });
		expect(restored.toSettings()).toEqual(restoredState);
		// Sanity: the original really moved while the restored handler did not
		expect(handler.toSettings()).not.toEqual(restoredState);
		expect(restoredEntities[0]!.getPos()).toEqual(restoredState.players[0]!.position);
		expect(restoredEntities[0]!.getVel()).toEqual(restoredState.players[0]!.velocity);

		// --- Serialization isolation: snapshots are defensive copies --------------
		const a = handler.toSettings();
		const b = handler.toSettings();
		expect(a).toEqual(b);
		expect(a).not.toBe(b);
		expect(a.players).not.toBe(b.players);
		expect(a.players[0]).not.toBe(b.players[0]);
		expect(a.players[0]!.inventory).not.toBe(b.players[0]!.inventory);
		expect(a.mapBoundarys).not.toBe(b.mapBoundarys);
		expect(a.effects).not.toBe(b.effects);
		expect(a.ruleState).not.toBe(b.ruleState);
		expect(a.matchResult).toBeUndefined();
		// Tampering with one snapshot must not leak into the next one
		a.players[0]!.position.x = 12345;
		expect(b.players[0]!.position.x).not.toBe(12345);
		// The serialized game mode is a defensive copy as well
		expect(a.gameMode).toEqual(settings.gameMode);
		expect(a.gameMode).not.toBe(settings.gameMode);
	});
});
