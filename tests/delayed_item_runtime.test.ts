import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { createItemDocument, type ItemDocument } from "../src/item/types.ts";
import { EffectType, ItemEffectType, SettingOperation } from "../src/effects/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

function delayedMagnetItem(targetType: "entity" | "position"): ItemDocument {
	return createItemDocument({
		id: `delayed-${targetType}`,
		targetType,
		effects: [{ type: ItemEffectType.DelayedEffect, value: { effectType: ItemEffectType.Magnet, effectValue: { mode: "repel", force: 1, range: 100 }, delayTicks: 1 } }],
		targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true },
		useLimit: { perTurn: 2, perGame: 2 },
	});
}

test("delayedEffect captures an entity target and executes exactly once when due", () => {
	const settings = createDefaultGameSettings(2, 1);
	const item = delayedMagnetItem("entity");
	settings.items = [item];
	settings.players[0]!.position = { x: 100, y: 100 };
	settings.players[1]!.position = { x: 180, y: 100 };
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const target = handler.getEntityManager().getEntities()[1]!;
	actor.setInventory([{ itemId: item.id, remainingUses: 1, usesThisTurn: 0 }]);

	handler.useItem(actor.getId(), item.id, { type: "entity", entityId: target.getId() });
	const scheduled = actor.getItemEffects()[0]!;
	expect(scheduled.type).toBe(ItemEffectType.DelayedEffect);
	expect(scheduled.typeValue.resolvedTarget).toEqual({ schemaVersion: 1, type: "entity", entityId: target.getId() });
	const before = target.getVel();

	handler.tick(1);

	expect(target.getVel().x).toBeLessThan(before.x);
	expect(actor.getItemEffects()).toEqual([]);
	const after = target.getVel();
	handler.tick(1);
	// The normal physics friction still advances; no second delayed impulse is applied.
	expect(target.getVel().x).toBeGreaterThan(after.x - 0.02);
});

test("delayedEffect captures a concrete position and resumes from a snapshot", () => {
	const settings = createDefaultGameSettings(2, 1);
	const item = delayedMagnetItem("position");
	settings.items = [item];
	settings.players[0]!.position = { x: 100, y: 100 };
	settings.players[1]!.position = { x: 180, y: 100 };
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const target = handler.getEntityManager().getEntities()[1]!;
	actor.setInventory([{ itemId: item.id, remainingUses: 1, usesThisTurn: 0 }]);

	handler.useItem(actor.getId(), item.id, { type: "position", position: { x: 100, y: 100 } });
	actor.setPos({ x: 0, y: 0 });
	const snapshot = handler.toSettings();
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();
	const restoredTarget = restored.getEntityManager().getEntities()[1]!;

	expect(restored.getEntityManager().getEntities()[0]!.getItemEffects()[0]!.typeValue.resolvedTarget).toEqual({ schemaVersion: 1, type: "position", position: { x: 100, y: 100 } });
	restored.tick(1);

	expect(restoredTarget.getVel().x).toBeLessThan(0);
});

test("delayedEffect rejects unsupported position nested Effects before consuming the item", () => {
	const settings = createDefaultGameSettings(2, 1);
	const item = createItemDocument({
		id: "delayed-position-unsupported",
		targetType: "position",
		effects: [{ type: ItemEffectType.DelayedEffect, value: { effectType: ItemEffectType.TemporalModifier, effectValue: { durationUnit: "turns", duration: 1, effect: { schemaVersion: 1, type: "movement.scale-speed", typeValue: { factor: 0.5 } } }, delayTicks: 1 } }],
	});
	settings.items = [item];
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	actor.setInventory([{ itemId: item.id, remainingUses: 1, usesThisTurn: 0 }]);

	expect(() => handler.useItem(actor.getId(), item.id, { type: "position", position: { x: 10, y: 10 } })).toThrow(/scheduled\/structural/);
	expect(actor.getInventory()[0]!.remainingUses).toBe(1);
});

test("delayedEffect executes a normal nested MultiEffect in declaration order", () => {
	const settings = createDefaultGameSettings(2, 1);
	const item = createItemDocument({
		id: "delayed-core-multi",
		targetType: "self",
		effects: [{ type: ItemEffectType.DelayedEffect, value: {
			nestedEffect: {
				schemaVersion: 1, type: EffectType.Multi,
				typeValue: [
					{ schemaVersion: 1, type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Add, key: "hp", value: -1 } },
					{ schemaVersion: 1, type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Add, key: "hp", value: -2 } },
				],
			},
			delayTicks: 1,
		} }],
	});
	settings.items = [item];
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	actor.setInventory([{ itemId: item.id, remainingUses: 1, usesThisTurn: 0 }]);

	handler.useItem(actor.getId(), item.id, { type: "self" });
	handler.tick(1);

	expect(actor.getHP()).toBe(27);
});
