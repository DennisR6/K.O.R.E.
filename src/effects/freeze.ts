import { ItemEffectType, type ItemEffectSettings } from "./types.js";

export interface FreezeValue {
	speedFactor: number;
	durationTurns: number;
	remainingTurns?: number;
}

/** A serializable movement-reduction effect with deterministic turn expiration. */
export class EffectFreeze {
	public readonly speedFactor: number;
	public readonly durationTurns: number;
	private remainingTurns: number;

	public constructor(settings: { typeValue: FreezeValue }) {
		const { speedFactor, durationTurns, remainingTurns = durationTurns } = settings.typeValue;
		if (!Number.isFinite(speedFactor) || speedFactor < 0 || speedFactor > 1) throw new Error("freeze speedFactor must be between zero and one");
		if (!Number.isSafeInteger(durationTurns) || durationTurns < 1) throw new Error("freeze durationTurns must be a positive integer");
		if (!Number.isSafeInteger(remainingTurns) || remainingTurns < 0 || remainingTurns > durationTurns) throw new Error("freeze remainingTurns must be between zero and durationTurns");
		this.speedFactor = speedFactor;
		this.durationTurns = durationTurns;
		this.remainingTurns = remainingTurns;
	}

	public applyToVelocity(velocity: { x: number; y: number }): { x: number; y: number } {
		if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) throw new Error("Freeze velocity must be finite");
		if (!this.isActive()) return { ...velocity };
		return { x: velocity.x * this.speedFactor, y: velocity.y * this.speedFactor };
	}

	public isActive(): boolean { return this.remainingTurns > 0; }
	public getRemainingTurns(): number { return this.remainingTurns; }
	public advanceTurn(): void { if (this.remainingTurns > 0) this.remainingTurns--; }

	public toSettings(): ItemEffectSettings {
		return {
			type: ItemEffectType.Freeze,
			typeValue: { speedFactor: this.speedFactor, durationTurns: this.durationTurns, remainingTurns: this.remainingTurns },
		};
	}
}
