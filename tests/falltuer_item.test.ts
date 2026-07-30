import { expect, test } from "bun:test";
import { createFalltuerKillZone, falltuerItem, isInsideFalltuerKillZone, createOfficialItemLoader } from "../src/item/officialItems.ts";

test("Falltür is a validated built-in position-targeted trap", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("falltuer")).toBe("built-in");
	expect(loader.get("falltuer")).toEqual(falltuerItem);
	expect(falltuerItem.targetType).toBe("position");
});

test("Falltür creates an immediate kill-zone trigger at the selected position", () => {
	const zone = createFalltuerKillZone({ x: 100, y: 120 });
	expect(zone.trigger.advanceTurn()).toBe(true);
	expect(isInsideFalltuerKillZone({ x: 110, y: 120 }, zone)).toBe(true);
	expect(isInsideFalltuerKillZone({ x: 130, y: 120 }, zone)).toBe(false);
});

test("Falltür rejects invalid positions and radii", () => {
	expect(() => createFalltuerKillZone({ x: Number.NaN, y: 1 })).toThrow("finite");
	expect(() => createFalltuerKillZone({ x: 1, y: 1 }, 0)).toThrow("positive");
});
