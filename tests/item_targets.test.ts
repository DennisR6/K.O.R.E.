import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { validateItemTarget, type ItemTargetContext } from "../src/item/target.ts";
import { createItemDocument } from "../src/item/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

function context(): ItemTargetContext {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings(2, 2)).build();
	const entities = handler.getEntityManager().getEntities();
	return { actor: entities[0], entities, worldSize: { x: 800, y: 450 } };
}

test("validates self, ally, and enemy entity targets", () => {
	const targetContext = context();
	const [actor, ally, enemy] = targetContext.entities;
	const item = createItemDocument({
		targetType: "entity",
		targetValidation: { allowSelf: false, allowAlly: true, allowEnemy: false, maxRange: 500 },
	});

	expect(() => validateItemTarget(item, { type: "entity", entityId: ally.getId() }, targetContext)).not.toThrow();
	expect(() => validateItemTarget(item, { type: "entity", entityId: actor.getId() }, targetContext)).toThrow("self");
	expect(() => validateItemTarget(item, { type: "entity", entityId: enemy.getId() }, targetContext)).toThrow("enemy");
});

test("rejects dead, unknown, mismatched, and out-of-range entity targets", () => {
	const targetContext = context();
	const item = createItemDocument({ targetType: "entity", targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true, maxRange: 10 } });
	const target = targetContext.entities[1];
	target.setPos({ x: 100, y: 100 });
	expect(() => validateItemTarget(item, { type: "entity", entityId: target.getId() }, targetContext)).toThrow("maximum range");
	expect(() => validateItemTarget(item, { type: "entity", entityId: "missing" }, targetContext)).toThrow("active entity");
	target.setIsDead(true);
	expect(() => validateItemTarget(item, { type: "entity", entityId: target.getId() }, targetContext)).toThrow("active entity");
	expect(() => validateItemTarget(createItemDocument({ targetType: "self" }), { type: "entity", entityId: target.getId() }, targetContext)).toThrow("self target");
});

test("validates finite in-world positions and circular zones", () => {
	const targetContext = context();
	const positionItem = createItemDocument({ targetType: "position", targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true, maxRange: 500 } });
	const zoneItem = createItemDocument({ targetType: "zone", targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true, maxRange: 500 } });

	expect(() => validateItemTarget(positionItem, { type: "position", position: { x: 200, y: 200 } }, targetContext)).not.toThrow();
	expect(() => validateItemTarget(positionItem, { type: "position", position: { x: -1, y: 20 } }, targetContext)).toThrow("inside the world");
	expect(() => validateItemTarget(positionItem, { type: "position", position: { x: Number.NaN, y: 20 } }, targetContext)).toThrow("finite");
	expect(() => validateItemTarget(zoneItem, { type: "zone", center: { x: 200, y: 200 }, radius: 20 }, targetContext)).not.toThrow();
	expect(() => validateItemTarget(zoneItem, { type: "zone", center: { x: 5, y: 5 }, radius: 20 }, targetContext)).toThrow("contained");
	expect(() => validateItemTarget(zoneItem, { type: "zone", center: { x: 200, y: 200 }, radius: 0 }, targetContext)).toThrow("positive radius");
});
