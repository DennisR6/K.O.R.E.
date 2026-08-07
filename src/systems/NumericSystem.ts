import { NUMERIC_ADD_EFFECT_ID, NUMERIC_EFFECT_IDS, NUMERIC_RESET_EFFECT_ID, NUMERIC_SET_EFFECT_ID, validateNumericEffectSettings } from "../engine/sdk/numericCapability.js";
import type { NumericThreshold } from "../engine/contracts/numericState.js";
import type { EngineEffectSettings } from "../engine/sdk/effectRegistry.js";
import type { IGameContext, IPredefinedEffectSystem, ResolvedPredefinedTarget, SystemSettings } from "./types.js";

/** Interprets typed entity-owned numeric mutations and returns crossed effects to the shared dispatcher. */
export class NumericSystem implements IPredefinedEffectSystem {
	public readonly systemId = "core.numeric";
	public toSettings(): SystemSettings { return { systemId: this.systemId, schemaVersion: 1, state: {} }; }
	public ticker(_ctx: IGameContext, _dt: number, _friction: number): void { }
	public acceptsEffect(effectId: string): boolean { return NUMERIC_EFFECT_IDS.includes(effectId as typeof NUMERIC_EFFECT_IDS[number]); }
	public applyEffect(_ctx: IGameContext, effect: EngineEffectSettings, target: ResolvedPredefinedTarget): EngineEffectSettings[] {
		if (target.type !== "numeric") throw new Error("Numeric effect requires a numeric target");
		validateNumericEffectSettings(effect);
		const owner = target.entity;
		const previous = owner.getNumericValue(target.stateId);
		const next = effect.type === NUMERIC_RESET_EFFECT_ID
			? owner.getNumericResetValue(target.stateId)
			: effect.type === NUMERIC_SET_EFFECT_ID
			? effect.typeValue.value
			: effect.type === NUMERIC_ADD_EFFECT_ID
				? previous + effect.typeValue.amount
				: undefined;
		if (next === undefined) throw new Error(`Numeric reset requires resetValue for '${target.stateId}'`);
		if (!Number.isFinite(next)) throw new Error("Numeric mutation produced a non-finite value");
		owner.setNumericValue(target.stateId, next);
		return owner.getNumericThresholds(target.stateId)
			.flatMap(binding => binding.thresholds)
			.filter(threshold => crossedThreshold(previous, next, threshold))
			.flatMap(threshold => threshold.effects.map(effect => structuredClone(effect)));
	}
}

function crossedThreshold(previous: number, current: number, threshold: NumericThreshold): boolean {
	return !matches(previous, threshold) && matches(current, threshold);
}

function matches(value: number, threshold: NumericThreshold): boolean {
	switch (threshold.comparator) {
		case "below": return value < threshold.value;
		case "below-or-equal": return value <= threshold.value;
		case "above": return value > threshold.value;
		case "above-or-equal": return value >= threshold.value;
	}
}
