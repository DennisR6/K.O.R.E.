import type { IKillable } from "../entity/types.js";
import type { SHAPE } from "../physics/physics.js";
import { type IEffectDamage, type IEffectWall } from "./types.js";

export class EffectDamage implements IEffectDamage {
	private damage: number
	constructor(damage: number) { this.damage = damage }
	isKillable(entity: any): entity is IKillable {
		const addHP = 'addHP' in entity && typeof entity.addHP === 'function';
		const setHP = 'setHP' in entity && typeof entity.setHP === 'function';
		const getHP = 'getHP' in entity && typeof entity.getHP === 'function';
		return (addHP && setHP && getHP)
	}
	apply({ entity }: { entity: SHAPE; }): void {
		if (this.isKillable(entity)) entity.addHP(-this.damage)
	}
}

export class EffectWall implements IEffectWall {
	constructor() { }
	apply({ }: { entity: SHAPE; }): void {
	}
}
