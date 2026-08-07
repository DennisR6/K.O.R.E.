import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { EffectType, ItemEffectType } from "../src/effects/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { createItemDocument } from "../src/item/types.ts";

function scheduledItem(targetType: "self" | "position" = "self") {
	return createItemDocument({
		id: "named-trigger-item",
		targetType,
		effects: [{ type: ItemEffectType.SpawnTrigger, value: { triggerId: "trap.explode", delayTurns: 0 } }],
		targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true },
	});
}

function settings(item: ReturnType<typeof scheduledItem>) {
	const game = createDefaultGameSettings(2, 1);
	game.items = [item];
	game.triggerDefinitions = [{ schemaVersion: 1, id: "trap.explode", effect: { type: EffectType.Damage, typeValue: { damage: 5 } } }];
	return game;
}

test("spawnTrigger resolves a named definition and activates exactly once at the next turn", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings(scheduledItem())).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const item = handler.toSettings().items[0]!;
	actor.setInventory([{ itemId: item.id, remainingUses: 1, usesThisTurn: 0 }]);

	handler.useItem(actor.getId(), item.id, { type: "self" });
	expect(actor.getHP()).toBe(30);
	expect(actor.getItemEffects()[0]!.typeValue.resolvedTarget).toEqual({ schemaVersion: 1, type: "entity", entityId: actor.getId() });

	handler.startTurn({ phase: handler.getRuleState().phase, activeTeam: 0, turnNumber: 1, itemUses: 0 });
	expect(actor.getHP()).toBe(25);
	handler.startTurn({ phase: handler.getRuleState().phase, activeTeam: 0, turnNumber: 2, itemUses: 0 });
	expect(actor.getHP()).toBe(25);
});

test("spawnTrigger rejects unknown definitions and unsupported position targets before consuming inventory", () => {
	const unknownItem = scheduledItem();
	const unknownSettings = createDefaultGameSettings(2, 1);
	unknownSettings.items = [unknownItem];
	const unknownHandler = new GameHandlerBuilder().defaultSystems().fromSettings(unknownSettings).build();
	const unknownActor = unknownHandler.getEntityManager().getEntities()[0]!;
	unknownActor.setInventory([{ itemId: unknownItem.id, remainingUses: 1, usesThisTurn: 0 }]);
	expect(() => unknownHandler.useItem(unknownActor.getId(), unknownItem.id, { type: "self" })).toThrow(/Unknown trigger definition/);
	expect(unknownActor.getInventory()[0]!.remainingUses).toBe(1);

	const positionItem = scheduledItem("position");
	const positionHandler = new GameHandlerBuilder().defaultSystems().fromSettings(settings(positionItem)).build();
	const positionActor = positionHandler.getEntityManager().getEntities()[0]!;
	positionActor.setInventory([{ itemId: positionItem.id, remainingUses: 1, usesThisTurn: 0 }]);
	expect(() => positionHandler.useItem(positionActor.getId(), positionItem.id, { type: "position", position: { x: 20, y: 20 } })).toThrow(/requires an entity/);
	expect(positionActor.getInventory()[0]!.remainingUses).toBe(1);
});

test("spawnTrigger schedule and definition survive snapshot restoration", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings(scheduledItem())).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const item = handler.toSettings().items[0]!;
	actor.setInventory([{ itemId: item.id, remainingUses: 1, usesThisTurn: 0 }]);
	handler.useItem(actor.getId(), item.id, { type: "self" });
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(handler.toSettings()).build();
	const restoredActor = restored.getEntityManager().getEntities()[0]!;

	expect(restored.toSettings().triggerDefinitions).toEqual(handler.toSettings().triggerDefinitions);
	restored.startTurn({ phase: restored.getRuleState().phase, activeTeam: 0, turnNumber: 1, itemUses: 0 });
	expect(restoredActor.getHP()).toBe(25);
});
