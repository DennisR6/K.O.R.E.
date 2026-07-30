import { expect, test } from "bun:test";
import { createFreezeShot, createOfficialItemLoader, freezeShotItem } from "../src/item/officialItems.ts";

test("Freeze-Shot is a validated built-in enemy-targeted item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("freeze-shot")).toBe("built-in");
	expect(loader.get("freeze-shot")).toEqual(freezeShotItem);
	expect(freezeShotItem.targetValidation).toEqual({ allowSelf: false, allowAlly: false, allowEnemy: true, maxRange: 300 });
});

test("Freeze-Shot reduces target speed and expires", () => {
	const freeze = createFreezeShot();
	expect(freeze.applyToVelocity({ x: 8, y: 4 })).toEqual({ x: 2, y: 1 });
	freeze.advanceTurn();
	freeze.advanceTurn();
	expect(freeze.applyToVelocity({ x: 8, y: 4 })).toEqual({ x: 8, y: 4 });
});

test("Freeze-Shot effect state is serializable", () => {
	const freeze = createFreezeShot();
	freeze.advanceTurn();
	expect(createFreezeShot().durationTurns).toBe(2);
	expect(freeze.toSettings().type).toBe("freeze");
});
