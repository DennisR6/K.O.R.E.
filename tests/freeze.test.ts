import { expect, test } from "bun:test";
import { EffectFreeze } from "../src/effects/freeze.ts";
import { ItemEffectType } from "../src/effects/types.ts";

test("freeze reduces movement while active and expires after its duration", () => {
	const freeze = new EffectFreeze({ typeValue: { speedFactor: 0.25, durationTurns: 2 } });
	expect(freeze.applyToVelocity({ x: 8, y: -4 })).toEqual({ x: 2, y: -1 });
	freeze.advanceTurn();
	expect(freeze.isActive()).toBe(true);
	freeze.advanceTurn();
	expect(freeze.isActive()).toBe(false);
	expect(freeze.applyToVelocity({ x: 8, y: -4 })).toEqual({ x: 8, y: -4 });
});

test("freeze serializes remaining duration", () => {
	const freeze = new EffectFreeze({ typeValue: { speedFactor: 0, durationTurns: 3 } });
	freeze.advanceTurn();
	const settings = freeze.toSettings();
	expect(settings).toEqual({ type: ItemEffectType.Freeze, typeValue: { speedFactor: 0, durationTurns: 3, remainingTurns: 2 } });
	expect(new EffectFreeze(settings).toSettings()).toEqual(settings);
});

test("freeze validates factor, duration, and velocity", () => {
	expect(() => new EffectFreeze({ typeValue: { speedFactor: 1.1, durationTurns: 1 } })).toThrow("between zero");
	expect(() => new EffectFreeze({ typeValue: { speedFactor: 0.5, durationTurns: 0 } })).toThrow("positive integer");
	const freeze = new EffectFreeze({ typeValue: { speedFactor: 0.5, durationTurns: 1 } });
	expect(() => freeze.applyToVelocity({ x: Number.NaN, y: 0 })).toThrow("finite");
});
