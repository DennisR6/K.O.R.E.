export interface RotationHazardConfig {
	degrees: number;
}

export interface RotatableHazardTarget {
	getRotation(): number;
	setRotation(rotation: number): void;
}

/** Adds a deterministic degree delta and normalizes rotation to [0, 360). */
export function applyRotationHazard(target: RotatableHazardTarget, config: RotationHazardConfig): void {
	if (!Number.isFinite(config.degrees)) throw new Error("Invalid rotation hazard config")
	target.setRotation(((target.getRotation() + config.degrees) % 360 + 360) % 360)
}
