import type { IPhysics, SHAPE } from "../physics/physics.js";
import { EffectType, SettingOperation, type Effect, type EffectSettings } from "./types.js";
import { EffectModifySetting } from "./modifySetting.js";

export interface EffectDamageType {
	damage: number
}
/** @deprecated Prefer EffectModifySetting with `{ operation: "add", key: "hp", value: -amount }`. */
export class EffectDamage implements Effect {
	private damage: number
	constructor({ typeValue }: { typeValue: EffectDamageType }) {
		this.damage = typeValue.damage
	}
	getType(): EffectType { return EffectType.Damage }
	apply(entity: IPhysics<SHAPE>, override?: EffectDamageType): void {
		let dmg = this.damage
		if (override) dmg = override.damage
		new EffectModifySetting({ typeValue: { operation: SettingOperation.Add, key: "hp", value: -dmg } }).apply(entity)
	}
	toSettings(): EffectSettings { return { typeValue: { damage: this.damage }, type: EffectType.Damage } }
}
