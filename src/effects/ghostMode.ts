import { ItemEffectType, type ItemEffectSettings } from "./types.js";

export interface GhostModeValue {
	durationTurns: number;
	remainingTurns?: number;
}

/** A serializable temporary collision filter used by Durchlässigkeit. */
export class EffectGhostMode {
	public readonly durationTurns: number;
	private remainingTurns: number;

	public constructor(settings: { typeValue: GhostModeValue }) {
		const { durationTurns, remainingTurns = durationTurns } = settings.typeValue;
		if (!Number.isSafeInteger(durationTurns) || durationTurns < 1) throw new Error("ghostMode durationTurns must be a positive integer");
		if (!Number.isSafeInteger(remainingTurns) || remainingTurns < 0 || remainingTurns > durationTurns) throw new Error("ghostMode remainingTurns must be between zero and durationTurns");
		this.durationTurns = durationTurns;
		this.remainingTurns = remainingTurns;
	}

	public isActive(): boolean { return this.remainingTurns > 0; }
	public shouldIgnoreCollision(): boolean { return this.isActive(); }
	public advanceTurn(): void { if (this.remainingTurns > 0) this.remainingTurns--; }
	public getRemainingTurns(): number { return this.remainingTurns; }

	public toSettings(): ItemEffectSettings {
		return { type: ItemEffectType.GhostMode, typeValue: { durationTurns: this.durationTurns, remainingTurns: this.remainingTurns } };
	}
}
