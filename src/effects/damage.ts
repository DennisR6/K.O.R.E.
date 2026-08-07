import type { IPhysics, SHAPE } from "../physics/physics.js";
import { EffectType, type Effect, type EffectSettings } from "./types.js";

export interface EffectDamageType {
	damage: number
}
/** Compatibility adapter: legacy Damage declarations now dispatch `numeric.add(hp, -amount)`. */
export class EffectDamage implements Effect {
	private damage: number
	constructor({ typeValue }: { typeValue: EffectDamageType }) {
		this.damage = typeValue.damage
	}
	getType(): EffectType { return EffectType.Damage }
	apply(entity: IPhysics<SHAPE>, override?: EffectDamageType): void {
		let dmg = this.damage
		if (override) dmg = override.damage
		if (!("getNumericValue" in entity)) return
		if (!("dispatchNumericAdd" in entity) || typeof entity.dispatchNumericAdd !== "function") throw new Error("Damage requires an attached numeric effect dispatcher")
		entity.dispatchNumericAdd("hp", -dmg)
	}
	toSettings(): EffectSettings { return { schemaVersion: 1, typeValue: { damage: this.damage }, type: EffectType.Damage } }
}
