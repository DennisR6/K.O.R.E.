export interface EliminableHazardTarget {
	setPhysicsEnabled(enabled: boolean): void;
	setDrawingEnabled(enabled: boolean): void;
	setVel(velocity: { x: number; y: number }): void;
}

/** Applies the shared elimination state used by all death mechanics. */
export function applyKillZoneHazard(target: EliminableHazardTarget): void {
	target.setPhysicsEnabled(false);
	target.setDrawingEnabled(false);
	target.setVel({ x: 0, y: 0 });
}
