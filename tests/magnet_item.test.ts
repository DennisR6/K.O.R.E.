import { expect, test } from "bun:test";
import { magnetItem, createOfficialItemLoader, MAGNET_FORCE, MAGNET_RANGE } from "../src/item/officialItems.ts";
import { applyRadialVelocityDelta } from "../src/engine/sdk/movementForceField.ts";

test("Magnet is a validated built-in configurable attraction item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("magnet")).toBe("built-in");
	expect(loader.get("magnet")).toEqual(magnetItem);
	expect(magnetItem.effects).toEqual([{ type: "movement.apply-force-to-entity", value: { mode: "attract", force: MAGNET_FORCE, range: MAGNET_RANGE } }]);
});

test("the generic radial movement language attracts or repels within its configured range", () => {
	expect(applyRadialVelocityDelta({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { mode: "attract", force: 2, range: 100 })).toEqual({ x: 3, y: 0 });
	expect(applyRadialVelocityDelta({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { mode: "repel", force: 2, range: 100 })).toEqual({ x: -1, y: 0 });
	expect(applyRadialVelocityDelta({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 101, y: 0 }, { mode: "attract", force: 2, range: 100 })).toEqual({ x: 1, y: 0 });
});

test("Magnet keeps its target, range, and use limits declarative", () => {
	expect(magnetItem.targetType).toBe("entity");
	expect(magnetItem.targetValidation).toEqual({ allowSelf: false, allowAlly: true, allowEnemy: true, maxRange: MAGNET_RANGE });
	expect(magnetItem.useLimit).toEqual({ perTurn: 1, perGame: 2 });
});
