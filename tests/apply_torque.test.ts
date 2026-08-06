import { expect, test } from "bun:test";
import { applyTorqueEffects, EffectApplyTorque } from "../src/effects/applyTorque.ts";
import { ItemEffectType } from "../src/effects/types.ts";

test("applyTorque updates angular velocity then rotation deterministically", () => {
	const effect = new EffectApplyTorque({ typeValue: { torque: 2 } });
	expect(effect.applyToAngularState({ rotation: 350, angularVelocity: 5 })).toEqual({ rotation: 357, angularVelocity: 7 });
	expect(effect.toSettings()).toEqual({ type: ItemEffectType.ApplyTorque, typeValue: { torque: 2 } });
});

test("applyTorque effects stack in declaration order and normalize rotation", () => {
	const result = applyTorqueEffects({ rotation: 359, angularVelocity: 1 }, [
		new EffectApplyTorque({ typeValue: { torque: 2 } }),
		new EffectApplyTorque({ typeValue: { torque: -1 } }),
	]);
	expect(result).toEqual({ rotation: 4, angularVelocity: 2 });
});

test("applyTorque rejects non-finite torque and angular state", () => {
	expect(() => new EffectApplyTorque({ typeValue: { torque: Number.NaN } })).toThrow("finite");
	const effect = new EffectApplyTorque({ typeValue: { torque: 1 } });
	expect(() => effect.applyToAngularState({ rotation: Number.POSITIVE_INFINITY, angularVelocity: 0 })).toThrow("finite");
});
