import { expect, test } from "bun:test";
import { applyRotationModifiers, EffectModifyRotation, normalizeRotation } from "../src/effects/modifyRotation.ts";
import { ItemEffectType } from "../src/effects/types.ts";

test("modifyRotation applies additive degrees and normalizes angles", () => {
	const effect = new EffectModifyRotation({ typeValue: { degrees: 45 } });
	expect(effect.applyToRotation(350)).toBe(35);
	expect(effect.applyToRotation(-90)).toBe(315);
	expect(effect.toSettings()).toEqual({ type: ItemEffectType.ModifyRotation, typeValue: { degrees: 45 } });
	expect(new EffectModifyRotation(effect.toSettings()).toSettings()).toEqual(effect.toSettings());
});

test("modifyRotation stacks deterministically in declaration order", () => {
	const result = applyRotationModifiers(350, [
		new EffectModifyRotation({ typeValue: { degrees: 20 } }),
		new EffectModifyRotation({ typeValue: { degrees: -40 } }),
	]);
	expect(result).toBe(330);
	expect(normalizeRotation(360 * 4 + 15)).toBe(15);
});

test("modifyRotation rejects non-finite values", () => {
	expect(() => new EffectModifyRotation({ typeValue: { degrees: Number.NaN } })).toThrow("finite");
	expect(() => new EffectModifyRotation({ typeValue: { degrees: Number.POSITIVE_INFINITY } })).toThrow("finite");
	expect(() => normalizeRotation(Number.NaN)).toThrow("finite");
});
