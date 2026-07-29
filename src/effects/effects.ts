import type { IPhysics, SHAPE } from "../physics/physics.js";
import { EffectDamage } from "./damage.js";
import { EffectModifyMass } from "./modifyMass.js";
import { EffectModifyPosition } from "./modifyPosition.js";
import { EffectModifySize } from "./modifySize.js";
import { EffectModifyTeam } from "./modifyTeam.js";
import { EffectModifyVelocity } from "./modifyVelocity.js";
import { EffectMove } from "./movement.js";
import { EffectPhysics } from "./physics.js";
import { EffectType, type Effect, type EffectSettings } from "./types.js";

export class MetaEffect implements Effect {
	private eff: Effect
	constructor(effect: EffectSettings) {
		switch (effect.type) {
			case EffectType.Damage: this.eff = new EffectDamage(effect); return
			case EffectType.Movement: this.eff = new EffectMove(effect); return
			case EffectType.Physics: this.eff = new EffectPhysics(effect); return
			case EffectType.Multi: this.eff = new EffectMove(effect); return
			case EffectType.ModifyMass: this.eff = new EffectModifyMass(effect); return
			case EffectType.Position: this.eff = new EffectModifyPosition(effect); return
			case EffectType.ModifySize: this.eff = new EffectModifySize(effect); return
			case EffectType.Team: this.eff = new EffectModifyTeam(effect); return
			case EffectType.Velocity: this.eff = new EffectModifyVelocity(effect); return
			default: {
				this.eff = new EffectMove(effect)
				console.trace("This item is not Implemented yet.", effect); return
			}
		}
	}
	apply(entity: IPhysics<SHAPE>, override?: any): void { this.eff.apply(entity, override) }
	getType(): EffectType { return this.eff.getType() }
	toSettings(): EffectSettings { return this.eff.toSettings() }
}

// export class MultiEffect implements MetaEffect {
// 	private eff: Effect[] = []
// 	constructor(effect: EffectSettings[]) {
// 		for (const eff of effect) this.eff.push(new MetaEffect(eff))
// 	}
// 	apply(entity: IPhysics<SHAPE>, override?: any): void {
// 		this.eff.apply(entity, override)
// 	}
// 	getType(): EffectType { return EffectType.Multi }
// 	toSettings(): EffectSettings {
// 		return {}
// 	}
// }
