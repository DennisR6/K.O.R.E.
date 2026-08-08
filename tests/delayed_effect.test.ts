import { expect, test } from "bun:test";
import { advanceDeferredEffect, createDeferredEffect } from "../src/engine/contracts/deferredEffect.ts";

function deferred(remaining?: number) {
	return createDeferredEffect({
		id: "mine:0",
		durationUnit: "ticks",
		duration: 2,
		effect: { schemaVersion: 1, type: "movement.apply-force-field", typeValue: { mode: "repel", force: 4, range: 60 }, target: { type: "position", position: { x: 100, y: 100 } } },
		...(remaining === undefined ? {} : { remaining }),
	});
}

test("deferred effects fire exactly once at the configured fixed tick", () => {
	const effect = deferred();
	expect(advanceDeferredEffect(effect)?.remaining).toBe(1);
	expect(advanceDeferredEffect(advanceDeferredEffect(effect)!)).toBeUndefined();
});

test("deferred effects serialize and restore their countdown state", () => {
	const effect = deferred(1);
	expect(JSON.parse(JSON.stringify(effect))).toEqual(effect);
	expect(advanceDeferredEffect(effect)).toBeUndefined();
});

test("deferred effects validate stable identity, tick duration, and Engine payload", () => {
	expect(() => createDeferredEffect({ id: "", durationUnit: "ticks", duration: 1, effect: { schemaVersion: 1, type: "movement.apply-force-field", typeValue: {} } })).toThrow("stable id");
	expect(() => createDeferredEffect({ id: "x", durationUnit: "turns" as never, duration: 1, effect: { schemaVersion: 1, type: "movement.apply-force-field", typeValue: {} } })).toThrow("ticks");
	expect(() => createDeferredEffect({ id: "x", durationUnit: "ticks", duration: 1, effect: { schemaVersion: 1, type: "unknown", typeValue: {} } })).not.toThrow();
});
