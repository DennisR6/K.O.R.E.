export interface KillableHazardTarget {
	setIsDead(dead: boolean): void;
}

/** Applies the shared elimination state used by all death mechanics. */
export function applyKillZoneHazard(target: KillableHazardTarget): void {
	target.setIsDead(true)
}
