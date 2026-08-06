export interface DelayedTriggerSettings {
	delayTicks: number;
	remainingTicks: number | null;
}

/** Schedules one activation after a deterministic number of simulation ticks. */
export class DelayedHazardTrigger {
	private remainingTicks: number | null = null;

	public constructor(private readonly delayTicks: number) {
		if (!Number.isSafeInteger(delayTicks) || delayTicks < 0) throw new Error("Delayed hazards require non-negative integer ticks")
	}
	public trigger(): void {
		if (this.remainingTicks === null) this.remainingTicks = this.delayTicks
	}
	/** Returns true exactly once when the scheduled countdown reaches zero. */
	public tick(): boolean {
		if (this.remainingTicks === null) return false
		if (this.remainingTicks > 0) {
			this.remainingTicks--
			if (this.remainingTicks > 0) return false
		}
		this.remainingTicks = null
		return true
	}
	public toSettings(): DelayedTriggerSettings { return { delayTicks: this.delayTicks, remainingTicks: this.remainingTicks } }
	public static fromSettings(settings: DelayedTriggerSettings): DelayedHazardTrigger {
		const trigger = new DelayedHazardTrigger(settings.delayTicks)
		if (settings.remainingTicks !== null && (!Number.isSafeInteger(settings.remainingTicks) || settings.remainingTicks < 0 || settings.remainingTicks > settings.delayTicks)) throw new Error("Invalid delayed hazard countdown")
		trigger.remainingTicks = settings.remainingTicks
		return trigger
	}
}
