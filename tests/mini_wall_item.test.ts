import { expect, test } from "bun:test";
import { createMiniWall, createOfficialItemLoader, miniWallItem } from "../src/item/officialItems.ts";

test("Mini-Wall is a validated built-in position-targeted item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("mini-wall")).toBe("built-in");
	expect(loader.get("mini-wall")).toEqual(miniWallItem);
});

test("Mini-Wall spawns and cleans up its temporary wall", () => {
	const wall = createMiniWall({ x: 100, y: 120 }, "wall-1");
	expect(wall.spawn()).toEqual({ wallId: "wall-1", x: 100, y: 120, w: 80, h: 10 });
	wall.advanceTurn();
	wall.advanceTurn();
	expect(wall.isActive()).toBe(true);
	expect(wall.advanceTurn()).toBe(true);
	expect(wall.isActive()).toBe(false);
});

test("Mini-Wall rejects invalid placement", () => {
	expect(() => createMiniWall({ x: Number.NaN, y: 0 })).toThrow("finite");
});
