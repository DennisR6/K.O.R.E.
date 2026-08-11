import { expect, test } from "bun:test";
import { advanceTemporalModifier, createTemporalModifier, validateTemporalModifier } from "@coffeemakerstudio/roast";
import { MOVEMENT_SCALE_SPEED_EFFECT_ID } from "@coffeemakerstudio/roast";

function modifier(remaining?: number) {
	return createTemporalModifier({
		id: "target-a:freeze-shot:0",
		target: { type: "entity", entityId: "target-a" },
		effect: { schemaVersion: 1, type: MOVEMENT_SCALE_SPEED_EFFECT_ID, typeValue: { factor: 0.25 }, target: { type: "entity", entityId: "target-a" } },
		durationUnit: "turns",
		duration: 2,
		...(remaining === undefined ? {} : { remaining }),
	});
}

test("temporal modifiers are canonical JSON state with deterministic turn expiry", () => {
	const active = modifier();
	expect(JSON.parse(JSON.stringify(active))).toEqual(active);
	expect(advanceTemporalModifier(active)?.remaining).toBe(1);
	expect(advanceTemporalModifier(advanceTemporalModifier(active)!) ).toBeUndefined();
});

test("temporal modifier restoration preserves target, effect, and remaining duration", () => {
	const restored = JSON.parse(JSON.stringify(modifier(1)));
	validateTemporalModifier(restored);
	expect(restored).toEqual(modifier(1));
});

test("temporal modifiers reject hidden or invalid lifecycle state", () => {
	expect(() => validateTemporalModifier({ ...modifier(), remaining: 0 })).toThrow(/remaining/);
	expect(() => validateTemporalModifier({ ...modifier(), target: { type: "entity", entityId: "" } })).toThrow(/target/);
	expect(() => validateTemporalModifier({ ...modifier(), effect: { schemaVersion: 1, type: MOVEMENT_SCALE_SPEED_EFFECT_ID, typeValue: { factor: 0.25 }, runtime: {} } })).toThrow();
});
