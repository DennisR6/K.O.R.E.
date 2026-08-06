import { expect, test } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { containsCircle, getOuterContainmentBoundaries } from "../src/structures/containment.ts";
import { StructureCircle } from "../src/structures/structureCircle.ts";
import { StructureLine } from "../src/structures/structureLine.ts";
import { StructureRectangle } from "../src/structures/structureRectangle.ts";

function player(x: number, y: number, size: number = 1) {
	return new Player(createPlayerSettings({ position: { x, y }, size }));
}

test("outer rectangle containment includes full player circles", () => {
	const outer = new StructureRectangle(0, 0, 100, 100);
	expect(containsCircle(outer, player(99, 50))).toBe(true);
	expect(containsCircle(outer, player(99.1, 50))).toBe(false);
});

test("outer circle containment includes full player circles", () => {
	const outer = new StructureCircle(0, 0, 10, undefined, []);
	expect(containsCircle(outer, player(9, 0))).toBe(true);
	expect(containsCircle(outer, player(9.1, 0))).toBe(false);
});

test("outer-boundary heuristic ignores line obstacles and inner structures", () => {
	const outer = new StructureRectangle(0, 0, 100, 100);
	const inner = new StructureCircle(50, 50, 5, undefined, []);
	const line = new StructureLine(0, 0, 100, 0, "black");
	expect(getOuterContainmentBoundaries([outer, inner, line])).toEqual([outer]);
});

test("a lone collision obstacle is not inferred as containment", () => {
	expect(getOuterContainmentBoundaries([new StructureCircle(50, 50, 5, undefined, [])])).toEqual([]);
});
