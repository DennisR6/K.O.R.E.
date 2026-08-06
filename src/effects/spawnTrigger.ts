import { ItemEffectType, type ItemEffectSettings } from "./types.js";

export interface SpawnTriggerValue {
	triggerId: string;
	delayTurns: number;
	remainingTurns?: number;
	fired?: boolean;
}

/** A serializable one-shot trigger that activates after a deterministic turn delay. */
export class EffectSpawnTrigger {
	public readonly triggerId: string;
	public readonly delayTurns: number;
	private remainingTurns: number;
	private fired: boolean;

	public constructor(settings: { typeValue: SpawnTriggerValue }) {
		const { triggerId, delayTurns, remainingTurns = delayTurns, fired = false } = settings.typeValue;
		if (typeof triggerId !== "string" || triggerId.length === 0) throw new Error("spawnTrigger requires a non-empty triggerId");
		if (!Number.isSafeInteger(delayTurns) || delayTurns < 0) throw new Error("spawnTrigger delayTurns must be a non-negative integer");
		if (!Number.isSafeInteger(remainingTurns) || remainingTurns < 0 || remainingTurns > delayTurns) throw new Error("spawnTrigger remainingTurns must be between zero and delayTurns");
		if (typeof fired !== "boolean") throw new Error("spawnTrigger fired must be boolean");
		if (fired && remainingTurns !== 0) throw new Error("A fired spawnTrigger must have zero remaining turns");
		this.triggerId = triggerId;
		this.delayTurns = delayTurns;
		this.remainingTurns = remainingTurns;
		this.fired = fired;
	}

	/** Advances one turn and returns true exactly once when the trigger fires. */
	public advanceTurn(): boolean {
		if (this.fired) return false;
		if (this.remainingTurns > 0) this.remainingTurns--;
		if (this.remainingTurns !== 0) return false;
		this.fired = true;
		return true;
	}

	public hasFired(): boolean { return this.fired; }
	public getRemainingTurns(): number { return this.remainingTurns; }

	public toSettings(): ItemEffectSettings {
		return {
			type: ItemEffectType.SpawnTrigger,
			typeValue: {
				triggerId: this.triggerId,
				delayTurns: this.delayTurns,
				remainingTurns: this.remainingTurns,
				fired: this.fired,
			},
		};
	}
}
