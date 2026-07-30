import { ItemEffectType, type AngularState, type ItemEffectSettings } from "./types.js";
import { normalizeRotation } from "./modifyRotation.js";

export interface ApplyTorqueValue {
	torque: number;
}

/** A serializable angular-acceleration primitive applied once per simulation tick. */
export class EffectApplyTorque {
	public readonly torque: number;

	public constructor(settings: { typeValue: ApplyTorqueValue }) {
		if (!Number.isFinite(settings.typeValue.torque)) {
			throw new Error("applyTorque torque must be finite");
		}
		this.torque = settings.typeValue.torque;
	}

	public applyToAngularState(state: AngularState): AngularState {
		if (!Number.isFinite(state.rotation) || !Number.isFinite(state.angularVelocity)) {
			throw new Error("Angular state must be finite");
		}
		const angularVelocity = state.angularVelocity + this.torque;
		return {
			rotation: normalizeRotation(state.rotation + angularVelocity),
			angularVelocity,
		};
	}

	public toSettings(): ItemEffectSettings {
		return { type: ItemEffectType.ApplyTorque, typeValue: { torque: this.torque } };
	}
}

/** Applies torque effects in declaration order for deterministic stacking. */
export function applyTorqueEffects(state: AngularState, effects: readonly EffectApplyTorque[]): AngularState {
	return effects.reduce((current, effect) => effect.applyToAngularState(current), {
		rotation: normalizeRotation(state.rotation),
		angularVelocity: state.angularVelocity,
	});
}
