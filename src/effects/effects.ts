import type { IPhysics, SHAPE } from "../physics/physics.js";
import { EffectDamage } from "./damage.js";
import { EffectModifyMass } from "./modifyMass.js";
import { EffectModifyPosition } from "./modifyPosition.js";
import { EffectModifySize } from "./modifySize.js";
import { EffectModifyTeam } from "./modifyTeam.js";
import { EffectModifyVelocity } from "./modifyVelocity.js";
import { EffectModifySetting } from "./modifySetting.js";
import { EffectMove } from "./movement.js";
import { EffectPhysics } from "./physics.js";
import { EffectType, type Effect, type EffectSettings } from "./types.js";
import { createRuntimeEffect } from "./runtimeFactory.js";
import { validateEffectSettings } from "./validate.js";

/**
 * Applies a list of child effects in order and round-trips their settings.
 *
 * The `typeValue` of a serialized Multi effect is an array of `EffectSettings`.
 */
export class MultiEffect implements Effect {
	private children: Effect[]

	constructor(effect: EffectSettings) {
		const children = effect.typeValue
		if (!Array.isArray(children)) throw new Error("EffectType.Multi requires a typeValue array of effect settings")
		this.children = children.map(child => createRuntimeEffect(child))
	}
	apply(entity: IPhysics<SHAPE>, override?: Object): void { for (const child of this.children) child.apply(entity, override) }
	getType(): EffectType { return EffectType.Multi }
	toSettings(): EffectSettings { return { type: EffectType.Multi, typeValue: this.children.map(child => child.toSettings()) } }
}

export class MetaEffect implements Effect {
	private eff: Effect
	constructor(effect: EffectSettings) {
		validateEffectSettings(effect)
		switch (effect.type) {
			case EffectType.Damage: this.eff = new EffectDamage(effect); return
			case EffectType.Movement: this.eff = new EffectMove(effect); return
			case EffectType.Physics: this.eff = new EffectPhysics(effect); return
			case EffectType.Multi: this.eff = new MultiEffect(effect); return
			case EffectType.ModifyMass: this.eff = new EffectModifyMass(effect); return
			case EffectType.Position: this.eff = new EffectModifyPosition(effect); return
			case EffectType.ModifySize: this.eff = new EffectModifySize(effect); return
			case EffectType.Team: this.eff = new EffectModifyTeam(effect); return
			case EffectType.Velocity: this.eff = new EffectModifyVelocity(effect); return
			case EffectType.ModifySetting: this.eff = new EffectModifySetting(effect); return
			default: {
				// Never silently substitute a wrong behavior for an unknown
				// effect: a rejected effect fails loudly at the boundary.
				throw new Error(`Unknown effect type "${String((effect as { type?: unknown }).type)}"`)
			}
		}
	}
	apply(entity: IPhysics<SHAPE>, override?: any): void { this.eff.apply(entity, override) }
	getType(): EffectType { return this.eff.getType() }
	toSettings(): EffectSettings { return this.eff.toSettings() }
}
