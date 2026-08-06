import { expect, test } from "bun:test";
import { EffectDelayed } from "../src/effects/delayedEffect.ts";
import { ItemEffectType } from "../src/effects/types.ts";

test("delayedEffect fires exactly on the configured fixed tick", () => {
	const effect = new EffectDelayed({ typeValue: { effectType: "modifyForce", effectValue: { factor: 0.5 }, delayTicks: 2 } });
	expect(effect.advanceTick()).toBe(false);
	expect(effect.getRemainingTicks()).toBe(1);
	expect(effect.advanceTick()).toBe(true);
	expect(effect.hasFired()).toBe(true);
	expect(effect.advanceTick()).toBe(false);
});

test("delayedEffect serializes and restores its countdown state", () => {
	const effect = new EffectDelayed({ typeValue: { effectType: "modifyRotation", delayTicks: 3 } });
	effect.advanceTick();
	const settings = effect.toSettings();
	expect(settings).toEqual({ type: ItemEffectType.DelayedEffect, typeValue: { effectType: "modifyRotation", effectValue: undefined, delayTicks: 3, remainingTicks: 2, fired: false } });
	const restored = new EffectDelayed(settings);
	expect(restored.advanceTick()).toBe(false);
	expect(restored.advanceTick()).toBe(true);
});

test("delayedEffect validates its type and countdown", () => {
	expect(() => new EffectDelayed({ typeValue: { effectType: "", delayTicks: 1 } })).toThrow("effectType");
	expect(() => new EffectDelayed({ typeValue: { effectType: "modifyForce", delayTicks: -1 } })).toThrow("non-negative");
	expect(() => new EffectDelayed({ typeValue: { effectType: "modifyForce", delayTicks: 1, remainingTicks: 2 } })).toThrow("between zero");
});
