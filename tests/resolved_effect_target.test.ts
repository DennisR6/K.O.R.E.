import { expect, test } from "bun:test";
import { createEntityResolvedTarget, createPositionResolvedTarget, validateResolvedEffectTarget } from "../src/item/resolvedTarget.ts";
import { createDeferredEffect, validateDeferredEffect } from "@coffeemakerstudio/roast";

test("resolved targets are detached, versioned, and strictly validated", () => {
	const position = { x: 12, y: 34 };
	const target = createPositionResolvedTarget(position);
	position.x = 99;

	expect(target).toEqual({ schemaVersion: 1, type: "position", position: { x: 12, y: 34 } });
	expect(createEntityResolvedTarget("entity-1")).toEqual({ schemaVersion: 1, type: "entity", entityId: "entity-1" });
	expect(() => validateResolvedEffectTarget({ schemaVersion: 1, type: "position", position: { x: 0, y: 0, z: 1 } })).toThrow(/unknown field/);
});

test("deferred Engine state preserves a detached position target", () => {
	const effect = createDeferredEffect({ id: "mine:1", durationUnit: "ticks", duration: 2, effect: { schemaVersion: 1, type: "movement.apply-force-field", typeValue: { mode: "repel", force: 1, range: 10 }, target: { type: "position", position: { x: 2, y: 3 } } } });
	validateDeferredEffect(effect);
	expect(effect.effect.target).toEqual({ type: "position", position: { x: 2, y: 3 } });
});
