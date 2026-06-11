import type { IPhysics, SHAPE, Vector2D } from "../physics/physics.js";
import { EffectType, type Effect, type EffectSettings } from "./types.js";

export type EffectMoveInput = { deltaTime: number } & Vector2D
export class EffectMove implements Effect {
	private x: number = 0
	private y: number = 0
	private dt: number = 0
	constructor({ typeValue }: { typeValue: EffectMoveInput }) {
		this.dt = typeValue.deltaTime
		this.x = typeValue.x
		this.y = typeValue.y
	}

	apply(entity: IPhysics<SHAPE>, override?: EffectMoveInput): void {
		let vx = this.x
		let vy = this.y
		let dt = this.dt
		if (override) {
			dt = this.dt !== 0 ? this.dt : override.deltaTime
			vx = this.x !== 0 ? this.x : override.x
			vy = this.y !== 0 ? this.y : override.y
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
