import { expect, test } from "bun:test";
import type { RenderContext } from "../src/kore/runtime/RenderContext.ts";
import { StructureCircle } from "../src/structures/structureCircle.ts";

test("circle rendering uses the collision center and radius", () => {
	const calls: Array<[number, number, number]> = [];
	const context = {
		push() { }, pop() { }, setFillColor() { },
		drawCircle(x: number, y: number, radius: number) { calls.push([x, y, radius]); },
	} as unknown as RenderContext;

	new StructureCircle(100, 200, 10, "blue", []).draw(context);
	expect(calls).toEqual([[100, 200, 10]]);
});
