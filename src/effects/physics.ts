import { defaultPhysics } from "../physics/defaultPhysics.js";
import type { IPhysics, SHAPE } from "../physics/physics.js";
import { type FrictionSettings } from "../settings/settings.js";
import { EffectType, type Effect, type EffectSettings } from "./types.js";

export const enum EffectPhysicsValues { Friction, LinearDrag, StopThreshold }
export class EffectPhysics implements Effect {
	friction: number
	linearDrag: number
	stopThreshold: number
	physics: defaultPhysics

	constructor({ typeValue }: { typeValue: FrictionSettings }) {
		this.friction = typeValue.friction
		this.linearDrag = typeValue.linearDrag
		this.stopThreshold = typeValue.stopThreshold
		this.friction = typeValue.friction
		this.physics = new defaultPhysics(typeValue)
	}
	apply(entity: IPhysics<SHAPE>, override?: { friction: number, dt?: number }): void {
		let friction = this.friction
		let dt = override?.dt ?? 1
		if (override) {
			friction = this.friction === 0 ? override.friction : friction
		}
		this.physics.applyFriction(entity, dt)
	}
	getType(): EffectType { return EffectType.Physics }
	toSettings(): EffectSettings {
		return {
			 schemaVersion: 1, type: EffectType.Physics,
			typeValue: {
				friction: this.friction,
				linearDrag: this.linearDrag,
				stopThreshold: this.stopThreshold,
			}
		}
	}
}
