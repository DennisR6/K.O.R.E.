import { expect, test } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import { StructureLine } from "../src/structures/structureLine.ts";

const physics = new defaultPhysics();

function circle(x: number, y: number) {
	return new Player(createPlayerSettings({ position: { x, y }, size: 1 }));
}

test("circle-line collision detects both horizontal normal directions", () => {
	const line = new StructureLine(0, 0, 10, 0, "black");
	expect(physics.checkCollision(circle(5, 1), line)).toBe(true);
	expect(physics.checkCollision(line, circle(5, -1))).toBe(true);
	expect(physics.checkCollision(circle(5, 1.01), line)).toBe(false);
	expect(physics.checkCollision(circle(5, -1.01), line)).toBe(false);
});

test("circle-line collision detects both vertical normal directions", () => {
	const line = new StructureLine(0, 0, 0, 10, "black");
	expect(physics.checkCollision(circle(1, 5), line)).toBe(true);
	expect(physics.checkCollision(line, circle(-1, 5))).toBe(true);
	expect(physics.checkCollision(circle(1.01, 5), line)).toBe(false);
	expect(physics.checkCollision(circle(-1.01, 5), line)).toBe(false);
});
