import { ItemEffectType, type ForceInput, type ItemEffectSettings } from "./types.js";

export interface ModifyForceValue {
	factor: number;
}

/** A serializable multiplicative modifier for an outgoing force value. */
export class EffectModifyForce {
	public readonly factor: number;

	public constructor(settings: { typeValue: ModifyForceValue }) {
		if (!Number.isFinite(settings.typeValue.factor) || settings.typeValue.factor < 0) {
			throw new Error("modifyForce factor must be a finite non-negative number");
		}
		this.factor = settings.typeValue.factor;
	}

	public applyToForce(force: ForceInput): ForceInput {
		if (!Number.isFinite(force.angle) || !Number.isFinite(force.power) || force.power < 0) {
			throw new Error("Force input must have a finite angle and non-negative power");
		}
		return { angle: normalizeAngle(force.angle), power: force.power * this.factor };
	}

	public toSettings(): ItemEffectSettings {
		return { type: ItemEffectType.ModifyForce, typeValue: { factor: this.factor } };
	}
}

/** Applies modifiers in declaration order; stacking is deterministic multiplication. */
export function applyForceModifiers(force: ForceInput, modifiers: readonly EffectModifyForce[]): ForceInput {
	return modifiers.reduce((current, modifier) => modifier.applyToForce(current), {
		angle: normalizeAngle(force.angle),
		power: force.power,
	});
}

function normalizeAngle(angle: number): number {
	return ((angle % 360) + 360) % 360;
}
