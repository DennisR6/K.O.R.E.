import { expect, test } from "bun:test";
import { getSlowZoneFriction } from "../src/hazards/slowZone.ts";

test("slow zones alter friction only while a figure overlaps", () => {
	const base = { friction: 0.9, linearDrag: 0.2, stopThreshold: 0.1 };
	const config = { frictionMultiplier: 0.5, linearDragMultiplier: 3 };
	expect(getSlowZoneFriction(base, true, config)).toEqual({ friction: 0.45, linearDrag: 0.6000000000000001, stopThreshold: 0.1 });
	expect(getSlowZoneFriction(base, false, config)).toEqual(base);
	expect(() => getSlowZoneFriction(base, true, { ...config, linearDragMultiplier: -1 })).toThrow("Invalid slow-zone hazard config");
});
