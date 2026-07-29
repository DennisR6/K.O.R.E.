import type { IPhysics, SHAPE } from "../physics/physics.js";
import { EffectType, type Effect, type EffectSettings } from "./types.js";

export class EffectModifyMass implements Effect {
	mass: number

	constructor({ typeValue }: { typeValue: { mass: number } }) {
		this.mass = typeValue.mass
	}
	apply(entity: IPhysics<SHAPE>, override?: { mass: number }): void {
		let mass = this.mass
		if (override) {
			mass = this.mass === 0 ? override.mass : mass
		}
		entity.setMass(mass)
	}
	getType(): EffectType { return EffectType.ModifyMass }
	toSettings(): EffectSettings {
		return {
			type: EffectType.ModifyMass,
			typeValue: { mass: this.mass }
		}
	}
}
