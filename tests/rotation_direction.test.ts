import { expect, test } from "bun:test";
import { forwardVectorFromRotation } from "@coffeemakerstudio/bean";

test("rotation forward vectors use screen-space cardinal directions", () => {
	for (const [rotation, expected] of [[0, { x: 1, y: 0 }], [90, { x: 0, y: 1 }], [180, { x: -1, y: 0 }], [270, { x: 0, y: -1 }]]) {
		const direction = forwardVectorFromRotation(rotation);
		expect(direction.x).toBeCloseTo(expected.x);
		expect(direction.y).toBeCloseTo(expected.y);
	}
});
