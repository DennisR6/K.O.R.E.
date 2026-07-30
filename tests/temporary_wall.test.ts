import { expect, test } from "bun:test";
import { EffectTemporaryWall } from "../src/effects/temporaryWall.ts";
import { ItemEffectType } from "../src/effects/types.ts";

test("temporaryWall spawns and cleans up after its configured lifetime", () => {
	const wall = new EffectTemporaryWall({ typeValue: { wallId: "mini-wall-1", x: 10, y: 20, w: 30, h: 5, durationTurns: 2, color: "orange" } });
	expect(wall.isActive()).toBe(false);
	expect(wall.spawn()).toEqual({ wallId: "mini-wall-1", x: 10, y: 20, w: 30, h: 5, color: "orange" });
	expect(wall.advanceTurn()).toBe(false);
	expect(wall.isActive()).toBe(true);
	expect(wall.advanceTurn()).toBe(true);
	expect(wall.isActive()).toBe(false);
});

test("temporaryWall serializes active cleanup state", () => {
	const wall = new EffectTemporaryWall({ typeValue: { wallId: "wall", x: 0, y: 0, w: 10, h: 10, durationTurns: 3 } });
	wall.spawn();
	wall.advanceTurn();
	const settings = wall.toSettings();
	expect(settings).toEqual({ type: ItemEffectType.TemporaryWall, typeValue: { wallId: "wall", x: 0, y: 0, w: 10, h: 10, durationTurns: 3, remainingTurns: 2, active: true } });
	expect(new EffectTemporaryWall(settings).toSettings()).toEqual(settings);
});

test("temporaryWall rejects invalid geometry and lifetime", () => {
	expect(() => new EffectTemporaryWall({ typeValue: { wallId: "", x: 0, y: 0, w: 1, h: 1, durationTurns: 1 } })).toThrow("wallId");
	expect(() => new EffectTemporaryWall({ typeValue: { wallId: "wall", x: 0, y: 0, w: 0, h: 1, durationTurns: 1 } })).toThrow("positive dimensions");
	expect(() => new EffectTemporaryWall({ typeValue: { wallId: "wall", x: 0, y: 0, w: 1, h: 1, durationTurns: 0 } })).toThrow("positive integer");
});
