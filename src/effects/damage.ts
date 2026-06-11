import type { ISettingsSerialize } from "../engine/types.js";
import type { IKillable } from "../entity/types.js";
import type { IPhysics, SHAPE } from "../physics/physics.js";
import { EffectType, type Effect, type EffectSettings } from "./types.js";

export interface EffectDamageType {
	damage: number
}
export class EffectDamage implements Effect, ISettingsSerialize<EffectSettings> {
	private damage: number
	constructor({ typeValue }: { typeValue: EffectDamageType }) {
		this.damage = typeValue.damage
	}
	isKillable(entity: any): entity is IKillable {
		const addHP = 'addHP' in entity && typeof entity.addHP === 'function';
		const setHP = 'setHP' in entity && typeof entity.setHP === 'function';
		const getHP = 'getHP' in entity && typeof entity.getHP === 'function';
		return (addHP && setHP && getHP)
	}
	getType(): EffectType { return EffectType.Damage }
	apply(entity: IPhysics<SHAPE>, override?: EffectDamageType): void {
		if (!this.isKillable(entity)) return
		let dmg = this.damage
		if (override) dmg = override.damage
		entity.addHP(dmg)
	}
	toSettings(): EffectSettings { return { typeValue: { damage: this.damage }, type: EffectType.Damage } }
}

