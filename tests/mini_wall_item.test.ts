import { expect, test } from "bun:test";
import { createMiniWall, createOfficialItemLoader, miniWallItem } from "../src/item/officialItems.ts";

test("Mini-Wall is a validated built-in position-targeted item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("mini-wall")).toBe("built-in");
	expect(loader.get("mini-wall")).toEqual(miniWallItem);
});

test("Mini-Wall lowers to a generic timed rectangle lifecycle", () => {
	const wall = createMiniWall({ x: 100, y: 120 }, "wall-1");
	expect(wall).toEqual({ durationUnit: "turns", duration: 3, structure: { type: "rectangle", w: 80, h: 10, role: "solid" } });
});

test("Mini-Wall authoring keeps placement in the validated gameplay target", () => {
	expect(createMiniWall({ x: Number.NaN, y: 0 }).structure).toEqual({ type: "rectangle", w: 80, h: 10, role: "solid" });
});
