import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createItemDocument } from "../src/item/types.ts";
import { RulePhase, WinCondition } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

test("map pickups collect deterministically for live entities on the active team and restore their turn limit", () => {
	const item = createItemDocument({ id: "dash", useLimit: { perTurn: 5, perGame: 3 } });
	const settings = {
		...createDefaultGameSettings(2, 2),
		items: [item],
		gameMode: {
			id: "pickup-test",
			phases: [RulePhase.Physics],
			maxItemsPerTurn: 0,
			winCondition: WinCondition.LastTeamStanding,
			itemEconomy: {
				fixedLoadouts: [],
				mapPickups: [{ itemId: item.id, spawnRegion: { x: 100, y: 100, w: 20, h: 20 }, activationType: "collision", maxPickupsPerTurn: 1 }],
			},
		},
	};
	settings.players.forEach(player => { player.position = { x: 0, y: 0 }; });
	settings.players[0].position = { x: 110, y: 110 };
	settings.players[0].isPhysicsEnabled = false;
	settings.players[0].isDrawingEnabled = false;
	settings.players[1].position = { x: 110, y: 110 };
	settings.players[2].position = { x: 110, y: 110 };

	const handler = new GameHandlerBuilder().fromSettings(settings).build();
	const [deadActive, active, enemy] = handler.getEntityManager().getEntities();
	handler.tick();

	expect(deadActive.getInventory()).toEqual([]);
	expect(active.getInventory()).toEqual([{ itemId: item.id, remainingUses: 1, usesThisTurn: 0 }]);
	expect(enemy.getInventory()).toEqual([]);
	handler.tick();
	expect(active.getInventory()).toEqual([{ itemId: item.id, remainingUses: 1, usesThisTurn: 0 }]);

	const restored = new GameHandlerBuilder().fromSettings(JSON.parse(JSON.stringify(handler.toSettings()))).build();
	const restoredActive = restored.getEntityManager().getEntityById(active.getId())!;
	restoredActive.setPos({ x: 0, y: 0 });
	restored.tick();
	restoredActive.setPos({ x: 110, y: 110 });
	restored.tick();
	expect(restoredActive.getInventory()).toEqual([{ itemId: item.id, remainingUses: 1, usesThisTurn: 0 }]);

	restored.startTurn({ phase: RulePhase.Physics, activeTeam: 1, turnNumber: 1, itemUses: 0 });
	restored.tick();
	const restoredEnemy = restored.getEntityManager().getEntityById(enemy.getId())!;
	expect(restoredEnemy.getInventory()).toEqual([{ itemId: item.id, remainingUses: 1, usesThisTurn: 0 }]);
});

test("map pickups serialize and honor a round-based respawn countdown", () => {
	const item = createItemDocument({ id: "respawning-dash", useLimit: { perTurn: 1, perGame: 5 } });
	const settings = {
		...createDefaultGameSettings(2, 1),
		items: [item],
		gameMode: {
			id: "respawn-test",
			phases: [RulePhase.Physics],
			maxItemsPerTurn: 0,
			winCondition: WinCondition.LastTeamStanding,
			itemEconomy: {
				fixedLoadouts: [],
				mapPickups: [{ itemId: item.id, spawnRegion: { x: 100, y: 100, w: 20, h: 20 }, activationType: "collision", respawnConfig: { intervalRounds: 2 } }],
			},
		},
	};
	settings.players.forEach(player => { player.position = { x: 0, y: 0 }; });
	settings.players[0].position = { x: 110, y: 110 };

	const handler = new GameHandlerBuilder().fromSettings(settings).build();
	const player = handler.getEntityManager().getEntities()[0];
	handler.tick();
	expect(handler.toSettings().itemPickupState?.pickups[0]).toEqual({ collected: 1, occupants: [player.getId()], respawnCountdown: 2 });

	handler.startTurn({ phase: RulePhase.Physics, activeTeam: 0, turnNumber: 1, itemUses: 0 });
	handler.tick();
	expect(handler.toSettings().itemPickupState?.pickups[0].respawnCountdown).toBe(1);
	expect(player.getInventory()).toHaveLength(1);

	handler.startTurn({ phase: RulePhase.Physics, activeTeam: 0, turnNumber: 2, itemUses: 0 });
	handler.tick();
	expect(handler.toSettings().itemPickupState?.pickups[0]).toEqual({ collected: 1, occupants: [player.getId()], respawnCountdown: 2 });
	expect(player.getInventory()).toEqual([{ itemId: item.id, remainingUses: 2, usesThisTurn: 0 }]);
});
