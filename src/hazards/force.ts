import type { IPhysics, PhysicsStrategy, SHAPE } from "@coffeemakerstudio/bean";

export interface ForceHazardConfig {
	angle: number;
	power: number;
}

/** Applies a serialized geyser-style impulse through the configured physics strategy. */
export function applyForceHazard(entity: IPhysics<SHAPE>, config: ForceHazardConfig, physics: PhysicsStrategy): void {
	if (!Number.isFinite(config.angle) || config.angle < 0 || config.angle >= 360 || !Number.isFinite(config.power) || config.power <= 0) {
		throw new Error("Invalid force hazard config")
	}
	physics.applyImpulse(entity, config.angle, config.power)
}
