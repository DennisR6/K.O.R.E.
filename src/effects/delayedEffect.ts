import { ItemEffectType, type EffectSettings, type ItemEffectSettings } from "./types.js";
import type { ResolvedEffectTarget } from "../item/resolvedTarget.js";

export interface DelayedEffectValue {
	effectType?: string;
	effectValue?: Record<string, unknown>;
	nestedEffect?: EffectSettings;
	delayTicks: number;
	remainingTicks?: number;
	fired?: boolean;
	resolvedTarget?: ResolvedEffectTarget;
}

/** A serializable one-shot effect scheduler using fixed simulation ticks. */
export class EffectDelayed {
	public readonly effectType: string;
	public readonly nestedEffect: EffectSettings | undefined;
	public readonly effectValue: Record<string, unknown> | undefined;
	public readonly delayTicks: number;
	public readonly resolvedTarget: ResolvedEffectTarget | undefined;
	private remainingTicks: number;
	private fired: boolean;

	public constructor(settings: { typeValue: DelayedEffectValue }) {
		const { effectType, effectValue, delayTicks, remainingTicks = delayTicks, fired = false, resolvedTarget } = settings.typeValue;
		if ((effectType === undefined) === (settings.typeValue.nestedEffect === undefined)) throw new Error("delayedEffect requires exactly one nested Effect representation");
		if (effectType !== undefined && (typeof effectType !== "string" || effectType.length === 0)) throw new Error("delayedEffect requires a non-empty effectType");
		if (!Number.isSafeInteger(delayTicks) || delayTicks < 0) throw new Error("delayedEffect delayTicks must be a non-negative integer");
		if (!Number.isSafeInteger(remainingTicks) || remainingTicks < 0 || remainingTicks > delayTicks) throw new Error("delayedEffect remainingTicks must be between zero and delayTicks");
		if (typeof fired !== "boolean") throw new Error("delayedEffect fired must be boolean");
		if (fired && remainingTicks !== 0) throw new Error("A fired delayedEffect must have zero remaining ticks");
		this.effectType = effectType ?? "";
		this.effectValue = effectValue === undefined ? undefined : structuredClone(effectValue);
		this.nestedEffect = settings.typeValue.nestedEffect === undefined ? undefined : structuredClone(settings.typeValue.nestedEffect);
		this.resolvedTarget = resolvedTarget === undefined ? undefined : structuredClone(resolvedTarget);
		this.delayTicks = delayTicks;
		this.remainingTicks = remainingTicks;
		this.fired = fired;
	}

	/** Advances one fixed simulation tick and returns true exactly once when ready. */
	public advanceTick(): boolean {
		if (this.fired) return false;
		if (this.remainingTicks > 0) this.remainingTicks--;
		if (this.remainingTicks !== 0) return false;
		this.fired = true;
		return true;
	}

	public hasFired(): boolean { return this.fired; }
	public getRemainingTicks(): number { return this.remainingTicks; }

	public toSettings(): ItemEffectSettings {
		return {
			type: ItemEffectType.DelayedEffect,
			typeValue: {
				...(this.nestedEffect === undefined ? { effectType: this.effectType, ...(this.effectValue === undefined ? {} : { effectValue: structuredClone(this.effectValue) }) } : { nestedEffect: structuredClone(this.nestedEffect) }),
				delayTicks: this.delayTicks,
				...(this.resolvedTarget === undefined ? {} : { resolvedTarget: structuredClone(this.resolvedTarget) }),
				remainingTicks: this.remainingTicks,
				fired: this.fired,
			},
		};
	}
}
