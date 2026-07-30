import { expect, test } from "bun:test";
import { applyForceModifiers, EffectModifyForce } from "../src/effects/modifyForce.ts";
import { ItemEffectType } from "../src/effects/types.ts";

test("modifyForce serializes and applies one deterministic force multiplier", () => {
	const effect = new EffectModifyForce({ typeValue: { factor: 0.5 } });
	expect(effect.applyToForce({ angle: -90, power: 8 })).toEqual({ angle: 270, power: 4 });
	expect(effect.toSettings()).toEqual({ type: ItemEffectType.ModifyForce, typeValue: { factor: 0.5 } });
	const restored = new EffectModifyForce(effect.toSettings());
	expect(restored.toSettings()).toEqual(effect.toSettings());
});

test("modifyForce effects stack in declaration order by multiplication", () => {
	const result = applyForceModifiers({ angle: 450, power: 10 }, [
		new EffectModifyForce({ typeValue: { factor: 0.8 } }),
		new EffectModifyForce({ typeValue: { factor: 0.5 } }),
	]);
	expect(result).toEqual({ angle: 90, power: 4 });
});

test("modifyForce rejects invalid factors and force inputs", () => {
	expect(() => new EffectModifyForce({ typeValue: { factor: -1 } })).toThrow("non-negative");
	expect(() => new EffectModifyForce({ typeValue: { factor: Number.NaN } })).toThrow("finite");
	const effect = new EffectModifyForce({ typeValue: { factor: 1 } });
	expect(() => effect.applyToForce({ angle: 0, power: -1 })).toThrow("non-negative power");
});
