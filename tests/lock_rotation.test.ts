import { expect, test } from "bun:test";
import { EffectLockRotation } from "../src/effects/lockRotation.ts";
import { ItemEffectType } from "../src/effects/types.ts";

test("lockRotation remains active for its configured turns and expires", () => {
	const effect = new EffectLockRotation({ typeValue: { durationTurns: 2 } });
	expect(effect.isLocked()).toBe(true);
	expect(effect.getRemainingTurns()).toBe(2);
	effect.advanceTurn();
	expect(effect.isLocked()).toBe(true);
	effect.advanceTurn();
	expect(effect.isLocked()).toBe(false);
	expect(effect.getRemainingTurns()).toBe(0);
});

test("lockRotation serializes remaining lifetime for restoration", () => {
	const effect = new EffectLockRotation({ typeValue: { durationTurns: 3 } });
	effect.advanceTurn();
	const settings = effect.toSettings();
	expect(settings).toEqual({ type: ItemEffectType.LockRotation, typeValue: { durationTurns: 3, remainingTurns: 2 } });
	expect(new EffectLockRotation(settings).toSettings()).toEqual(settings);
});

test("lockRotation rejects invalid durations and countdowns", () => {
	expect(() => new EffectLockRotation({ typeValue: { durationTurns: 0 } })).toThrow("positive integer");
	expect(() => new EffectLockRotation({ typeValue: { durationTurns: 2, remainingTurns: 3 } })).toThrow("between zero");
});
