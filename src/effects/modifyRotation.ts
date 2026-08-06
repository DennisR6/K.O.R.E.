import { ItemEffectType, type ItemEffectSettings } from "./types.js";

export interface ModifyRotationValue {
	degrees: number;
}

/** A serializable additive rotation modifier using normalized degrees. */
export class EffectModifyRotation {
	public readonly degrees: number;

	public constructor(settings: { typeValue: ModifyRotationValue }) {
		if (!Number.isFinite(settings.typeValue.degrees)) {
			throw new Error("modifyRotation degrees must be finite");
		}
		this.degrees = settings.typeValue.degrees;
	}

	public applyToRotation(rotation: number): number {
		if (!Number.isFinite(rotation)) throw new Error("Rotation must be finite");
		return normalizeRotation(rotation + this.degrees);
	}

	public toSettings(): ItemEffectSettings {
		return { type: ItemEffectType.ModifyRotation, typeValue: { degrees: this.degrees } };
	}
}

/** Applies rotation modifiers in declaration order; each result is normalized. */
export function applyRotationModifiers(rotation: number, modifiers: readonly EffectModifyRotation[]): number {
	return modifiers.reduce((current, modifier) => modifier.applyToRotation(current), normalizeRotation(rotation));
}

export function normalizeRotation(rotation: number): number {
	if (!Number.isFinite(rotation)) throw new Error("Rotation must be finite");
	return ((rotation % 360) + 360) % 360;
}
