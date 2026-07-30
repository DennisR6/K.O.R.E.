import { expect, test } from "bun:test";
import { applySwitch, createOfficialItemLoader, switchItem } from "../src/item/officialItems.ts";

test("Switch is a validated ally-targeted built-in item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("switch")).toBe("built-in");
	expect(loader.get("switch")).toEqual(switchItem);
	expect(switchItem.targetValidation).toEqual({ allowSelf: false, allowAlly: true, allowEnemy: false, maxRange: 300 });
});

test("Switch exchanges two active figure positions atomically", () => {
	expect(applySwitch(
		{ id: "actor", position: { x: 10, y: 20 }, active: true },
		{ id: "ally", position: { x: 80, y: 90 }, active: true },
	)).toEqual([{ x: 80, y: 90 }, { x: 10, y: 20 }]);
});

test("Switch rejects inactive targets through the shared swap primitive", () => {
	expect(() => applySwitch(
		{ id: "actor", position: { x: 10, y: 20 }, active: true },
		{ id: "dead", position: { x: 80, y: 90 }, active: false },
	)).toThrow("active");
});
