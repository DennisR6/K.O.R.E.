import { expect, test } from "bun:test";
import { kore } from "../src/kore/sdk/index.js";
import { ItemEffectType } from "../src/effects/types.js";

function itemMap() {
	const item = kore.createItem({
		id: "sdk-freeze",
		name: "SDK Freeze",
		type: "utility",
		effects: [{ type: "freeze", value: { speedFactor: 0.25, durationTurns: 2 } }],
		targetType: "self",
		useLimit: { perTurn: 1, perGame: 1 },
		targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false },
	});
	return kore.createDefaultMap({ id: "44444444-4444-4444-8444-444444444444" })
		.addPlayerSpawn({ x: 40, y: 130, w: 120, h: 120, teamNr: 0, playerCount: 1 })
		.addPlayerSpawn({ x: 640, y: 130, w: 120, h: 120, teamNr: 1, playerCount: 1 })
		.addItem(item)
		.addFixedLoadout({ team: 0, items: [{ itemId: item.id, uses: 1 }] })
		.build();
}

test("public KORE item runtime resolves declarative effects without exposing constructors", () => {
	const effect = kore.itemRuntime.create({ type: ItemEffectType.Freeze, typeValue: { speedFactor: 0.5, durationTurns: 2 } });
	expect(effect.toSettings()).toEqual({
		type: ItemEffectType.Freeze,
		typeValue: { speedFactor: 0.5, durationTurns: 2, remainingTurns: 2 },
	});
	const force = kore.itemRuntime.applyForce({ angle: 15, power: 4 }, [
		kore.itemRuntime.create({ type: ItemEffectType.ModifyForce, typeValue: { factor: 0.5 } }),
	]);
	expect(force).toEqual({ angle: 15, power: 2 });
});

test("ordinary SDK item use applies state atomically and survives handler restoration", () => {
	const handler = kore.createHandler(itemMap());
	const actor = handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!;
	handler.useItem(actor.getId(), "sdk-freeze", { type: "self" });

	const used = actor.toSettings();
	expect(used.inventory).toEqual([{ itemId: "sdk-freeze", remainingUses: 0, usesThisTurn: 1 }]);
	expect(used.itemEffects).toEqual([{ type: ItemEffectType.Freeze, typeValue: { speedFactor: 0.25, durationTurns: 2, remainingTurns: 2 } }]);

	const snapshot = JSON.parse(JSON.stringify(handler.toSettings()));
	const restored = kore.restoreHandler(snapshot);
	const restoredActor = restored.getEntityManager().getEntityById(actor.getId())!;
	expect(restoredActor.toSettings().inventory).toEqual(used.inventory);
	expect(restoredActor.toSettings().itemEffects).toEqual(used.itemEffects);
	expect(JSON.stringify(restored.toSettings())).toBe(JSON.stringify(snapshot));
});

test("rejected SDK item use does not consume inventory or install effects", () => {
	const handler = kore.createHandler(itemMap());
	const actor = handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!;
	expect(() => handler.useItem(actor.getId(), "sdk-freeze", { type: "entity", entityId: actor.getId() })).toThrow("requires a self target");
	expect(actor.getInventory()).toEqual([{ itemId: "sdk-freeze", remainingUses: 1, usesThisTurn: 0 }]);
	expect(actor.getItemEffects()).toEqual([]);
});
