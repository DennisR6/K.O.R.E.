import { expect, test } from "bun:test";
import { createFreezeShot, createOfficialItemLoader, freezeShotItem } from "../src/item/officialItems.ts";

test("Freeze-Shot is a validated built-in enemy-targeted item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("freeze-shot")).toBe("built-in");
	expect(loader.get("freeze-shot")).toEqual(freezeShotItem);
	expect(freezeShotItem.targetValidation).toEqual({ allowSelf: false, allowAlly: false, allowEnemy: true, maxRange: 300 });
});

test("Freeze-Shot lowers to a generic temporal movement modifier", () => {
	const freeze = createFreezeShot();
	expect(freeze.durationUnit).toBe("turns");
	expect(freeze.duration).toBe(2);
	expect(freeze.effect).toEqual({ schemaVersion: 1, type: "movement.scale-speed", typeValue: { factor: 0.25 } });
});

test("Freeze-Shot effect state is serializable", () => {
	const freeze = createFreezeShot();
	expect(createFreezeShot().duration).toBe(2);
	expect(JSON.parse(JSON.stringify(freeze))).toEqual(freeze);
});
