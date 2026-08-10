import { ItemEffectType, type ItemEffectSettings } from "./types.js";

export interface SelectionLockValue {
	durationTurns: number;
	remainingTurns?: number;
}

/** Historical compatibility helper; current runtime uses actor eligibility constraints. */
export class EffectSelectionLock {
	public readonly durationTurns: number;
	private remainingTurns: number;

	public constructor(settings: { typeValue: SelectionLockValue }) {
		const { durationTurns, remainingTurns = durationTurns } = settings.typeValue;
		if (!Number.isSafeInteger(durationTurns) || durationTurns < 1) {
			throw new Error("selectionLock durationTurns must be a positive integer");
		}
		if (!Number.isSafeInteger(remainingTurns) || remainingTurns < 0 || remainingTurns > durationTurns) {
			throw new Error("selectionLock remainingTurns must be between zero and durationTurns");
		}
		this.durationTurns = durationTurns;
		this.remainingTurns = remainingTurns;
	}

	public isLocked(): boolean {
		return this.remainingTurns > 0;
	}

	/** Advances one completed turn and expires the selection lock at zero. */
	public advanceTurn(): void {
		if (this.remainingTurns > 0) this.remainingTurns--;
	}

	public getRemainingTurns(): number {
		return this.remainingTurns;
	}

	public toSettings(): ItemEffectSettings {
		return {
			type: ItemEffectType.SelectionLock,
			typeValue: { durationTurns: this.durationTurns, remainingTurns: this.remainingTurns },
		};
	}
}
