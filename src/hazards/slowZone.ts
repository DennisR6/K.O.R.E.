import type { FrictionSettings } from "../settings/settings.js";

export interface SlowZoneHazardConfig {
	frictionMultiplier: number;
	linearDragMultiplier: number;
}

/** Returns per-tick friction for an overlap; non-overlapping figures retain base physics. */
export function getSlowZoneFriction(base: FrictionSettings, overlapping: boolean, config: SlowZoneHazardConfig): FrictionSettings {
	if (!Number.isFinite(config.frictionMultiplier) || config.frictionMultiplier < 0 || !Number.isFinite(config.linearDragMultiplier) || config.linearDragMultiplier < 0) {
		throw new Error("Invalid slow-zone hazard config")
	}
	if (!overlapping) return { ...base }
	return {
		friction: base.friction * config.frictionMultiplier,
		linearDrag: base.linearDrag * config.linearDragMultiplier,
		stopThreshold: base.stopThreshold,
	}
}
