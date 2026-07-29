import { forwardVectorFromRotation, type IPhysics, SHAPE, type Vector2D } from "../physics/physics.js";
import { EffectType, type Effect, type EffectSettings } from "./types.js";

export type EffectMoveInput = { deltaTime: number } & Vector2D
export type EffectMoveOverride = EffectMoveInput & { drift?: number, rotation?: number, stopThreshold?: number }
export class EffectMove implements Effect {
	private x: number = 0
	private y: number = 0
	private dt: number = 0
	constructor({ typeValue }: { typeValue: EffectMoveInput }) {
		this.dt = typeValue.deltaTime
		this.x = typeValue.x
		this.y = typeValue.y
	}

	apply(entity: IPhysics<SHAPE>, override?: EffectMoveOverride): void {
		let vx = this.x
		let vy = this.y
		let dt = this.dt
		if (override) {
			dt = this.dt !== 0 ? this.dt : override.deltaTime
			vx = this.x !== 0 ? this.x : override.x
			vy = this.y !== 0 ? this.y : override.y
		}
		if (override?.rotation !== undefined && override.drift !== undefined) {
			const speed = Math.hypot(vx, vy)
			if (speed > (override.stopThreshold ?? 0) && override.drift > 0) {
				const forward = forwardVectorFromRotation(override.rotation)
				const blend = {
					x: (vx / speed) * (1 - override.drift) + forward.x * override.drift,
					y: (vy / speed) * (1 - override.drift) + forward.y * override.drift,
				}
				const blendLength = Math.hypot(blend.x, blend.y)
				const direction = blendLength === 0 ? forward : { x: blend.x / blendLength, y: blend.y / blendLength }
				vx = direction.x * speed
				vy = direction.y * speed
				entity.setVel({ x: vx, y: vy })
			}
		}
		const { x, y } = entity.getPos()
		entity.setPos({
			x: x + (vx * dt),
			y: y + (vy * dt),
		})
	}
	getType(): EffectType { return EffectType.Movement }
	toSettings(): EffectSettings {
		return { type: EffectType.Movement, typeValue: { deltaTime: this.dt, x: this.x, y: this.y } }
	}
}
