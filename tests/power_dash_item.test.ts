import { expect, test } from "bun:test";
import { applyPowerDashForce, createOfficialItemLoader, powerDashItem } from "../src/item/officialItems.ts";

test("Power-Dash is a validated built-in force-boost item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("power-dash")).toBe("built-in");
	expect(loader.get("power-dash")).toEqual(powerDashItem);
});

test("Power-Dash applies its configured force multiplier", () => {
	expect(applyPowerDashForce({ angle: -45, power: 4 })).toEqual({ angle: 315, power: 6 });
});

test("Power-Dash is self-targeted and limited per game", () => {
	expect(powerDashItem.targetType).toBe("self");
	expect(powerDashItem.duration).toEqual({ type: "instant", value: 0 });
	expect(powerDashItem.useLimit.perGame).toBe(2);
});
