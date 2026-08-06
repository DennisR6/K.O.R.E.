import { expect, test } from "bun:test";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import { StructureRectangle } from "../src/structures/structureRectangle.ts";

const physics = new defaultPhysics();
const first = new StructureRectangle(0, 0, 10, 10);

test("rectangle collision dispatch distinguishes separation, overlap, and edge contact", () => {
	expect(physics.checkCollision(first, new StructureRectangle(11, 0, 10, 10))).toBe(false);
	expect(physics.checkCollision(first, new StructureRectangle(9, 5, 10, 10))).toBe(true);
	expect(physics.checkCollision(first, new StructureRectangle(10, 0, 10, 10))).toBe(true);
});
