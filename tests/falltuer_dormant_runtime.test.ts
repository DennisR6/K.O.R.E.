import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { EffectType, ItemEffectType } from "../src/effects/types.ts";
import { falltuerItem, falltuerStructure, falltuerTriggerDefinitions, FALLTUER_STRUCTURE_ID } from "../src/item/officialItems.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { createItemDocument } from "../src/item/types.ts";

function falltuerSettings() {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = [falltuerItem];
	settings.mapBoundarys = [structuredClone(falltuerStructure)];
	settings.triggerDefinitions = structuredClone(falltuerTriggerDefinitions);
	return settings;
}

function buildFalltuer() {
	return new GameHandlerBuilder().defaultSystems().fromSettings(falltuerSettings()).build();
}

test("the canonical Falltür structure starts dormant and remains addressable", () => {
	const handler = buildFalltuer();
	const structure = handler.getContext().structures[0]!;

	expect(structure.getId()).toBe(FALLTUER_STRUCTURE_ID);
	expect(structure.physicsEnabled()).toBe(false);
	expect(structure.drawingEnabled()).toBe(false);
	expect(handler.toSettings().mapBoundarys[0]).toMatchObject({ id: FALLTUER_STRUCTURE_ID, physicsEnabled: false, drawingEnabled: false });
	for (const definition of falltuerTriggerDefinitions) {
		expect(definition.effect.type).toBe("effect.composition");
		expect((definition.effect as { effects: Array<{ type: string }> }).effects.every(effect => !effect.type.startsWith("EffectType."))).toBe(true);
	}
});

test("Falltür captures its position once, activates through ordered MultiEffects, and deactivates once", () => {
	const handler = buildFalltuer();
	const actor = handler.getEntityManager().getEntities()[0]!;
	actor.setPos({ x: 200, y: 200 });
	actor.setInventory([{ itemId: falltuerItem.id, remainingUses: 1, usesThisTurn: 0 }]);

	handler.useItem(actor.getId(), falltuerItem.id, { type: "position", position: { x: 220, y: 200 } });
	const scheduled = actor.getItemEffects();
	expect(scheduled).toHaveLength(2);
	expect(scheduled.every(effect => effect.type === ItemEffectType.SpawnTrigger)).toBe(true);
	expect(scheduled.every(effect => (effect.typeValue as { resolvedTarget?: { type?: string } }).resolvedTarget?.type === "structure")).toBe(true);
	expect(scheduled.every(effect => (effect.typeValue as { resolvedPosition?: unknown }).resolvedPosition !== undefined)).toBe(true);

	handler.setTurnNumber(1);
	const structure = handler.getContext().structures[0]!;
	expect(structure.getPos()).toEqual({ x: 220, y: 200 });
	expect(structure.physicsEnabled()).toBe(true);
	expect(structure.drawingEnabled()).toBe(true);
	const activeSnapshot = handler.toSettings();
	expect(activeSnapshot.mapBoundarys[0]).toMatchObject({ physicsEnabled: true, drawingEnabled: true, x: 220, y: 200 });

	handler.setTurnNumber(2);
	expect(structure.physicsEnabled()).toBe(false);
	expect(structure.drawingEnabled()).toBe(false);
	expect(actor.getItemEffects()).toHaveLength(0);
});

test("active Falltür collision uses the existing Structure Damage Effect", () => {
	const handler = buildFalltuer();
	const actor = handler.getEntityManager().getEntities()[0]!;
	actor.setPos({ x: 200, y: 200 });
	actor.setInventory([{ itemId: falltuerItem.id, remainingUses: 1, usesThisTurn: 0 }]);
	handler.useItem(actor.getId(), falltuerItem.id, { type: "position", position: { x: 200, y: 200 } });
	handler.setTurnNumber(1);
	handler.tick();

	expect(actor.isDead()).toBe(true);
});

test("Falltür activation and pending timeout restore without replaying activation", () => {
	const handler = buildFalltuer();
	const actor = handler.getEntityManager().getEntities()[0]!;
	actor.setPos({ x: 200, y: 200 });
	actor.setInventory([{ itemId: falltuerItem.id, remainingUses: 1, usesThisTurn: 0 }]);
	handler.useItem(actor.getId(), falltuerItem.id, { type: "position", position: { x: 220, y: 200 } });
	handler.setTurnNumber(1);

	const snapshot = handler.toSettings();
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();
	const restoredStructure = restored.getContext().structures[0]!;
	expect(restoredStructure.toSettings()).toEqual(snapshot.mapBoundarys[0]);
	expect(restoredStructure.physicsEnabled()).toBe(true);
	expect(restored.getEntityManager().getEntities()[0]!.getItemEffects()).toHaveLength(1);

	restored.setTurnNumber(3);
	expect(restoredStructure.physicsEnabled()).toBe(false);
	expect(restoredStructure.drawingEnabled()).toBe(false);
	expect(restored.getEntityManager().getEntities()[0]!.getItemEffects()).toHaveLength(0);
});

test("structure-targeted spawnTrigger rejects an unknown canonical structure before consuming inventory", () => {
	const settings = createDefaultGameSettings(2, 1);
	const item = createItemDocument({
		id: "unknown-structure-trigger",
		targetType: "position",
		effects: [{ type: ItemEffectType.SpawnTrigger, value: { triggerId: "structure.test", delayTurns: 0, structureId: "missing-structure" } }],
		targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true },
	});
	settings.items = [item];
	settings.triggerDefinitions = [{ schemaVersion: 1, id: "structure.test", effect: { schemaVersion: 1, type: EffectType.Multi, typeValue: [] } }];
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	actor.setInventory([{ itemId: item.id, remainingUses: 1, usesThisTurn: 0 }]);

	expect(() => handler.useItem(actor.getId(), item.id, { type: "position", position: { x: 20, y: 20 } })).toThrow("Unknown structure target");
	expect(actor.getInventory()[0]!.remainingUses).toBe(1);
});
