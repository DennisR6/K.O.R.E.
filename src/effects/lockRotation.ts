import { ItemEffectType, type ItemEffectSettings } from "./types.js";

export interface LockRotationValue {
	durationTurns: number;
	remainingTurns?: number;
}

/** A serializable rotation lock whose lifetime is measured in completed turns. */
export class EffectLockRotation {
	public readonly durationTurns: number;
	private remainingTurns: number;

	public constructor(settings: { typeValue: LockRotationValue }) {
		const { durationTurns, remainingTurns = durationTurns } = settings.typeValue;
		if (!Number.isSafeInteger(durationTurns) || durationTurns < 1) {
			throw new Error("lockRotation durationTurns must be a positive integer");
		}
		if (!Number.isSafeInteger(remainingTurns) || remainingTurns < 0 || remainingTurns > durationTurns) {
			throw new Error("lockRotation remainingTurns must be between zero and durationTurns");
		}
		this.durationTurns = durationTurns;
		this.remainingTurns = remainingTurns;
	}

	public isLocked(): boolean {
		return this.remainingTurns > 0;
	}

	/** Advances one completed turn and expires the lock at zero. */
	public advanceTurn(): void {
		if (this.remainingTurns > 0) this.remainingTurns--;
	}

	public getRemainingTurns(): number {
		return this.remainingTurns;
	}

	public toSettings(): ItemEffectSettings {
		return {
			type: ItemEffectType.LockRotation,
			typeValue: { durationTurns: this.durationTurns, remainingTurns: this.remainingTurns },
		};
	}
}
