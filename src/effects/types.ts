import type { ISettingsSerialize } from "../engine/types.js";
import type { IPhysics, SHAPE } from "../physics/physics.js";

export const enum EffectType {
	Physics = "EffectType.Physics",
	Damage = "EffectType.Damage",
	Movement = "EffectType.Movement",
	Multi = "EffectType.Multi",
	ModifyMass = "EffectType.ModifyMass",
	ModifySize = "EffectType.ModifySize",
	Position = "EffectType.Position",
	Velocity = "EffectType.Velocity",
	Team = "EffectType.Team"
}
export const enum EffectTrigger {
	Always = "EffectTrigger.Always",
	Collision = "EffectTrigger.Collision",
	Round = "EffectTrigger.Round"
}
export interface FullEffectSettings extends EffectSettings {
	trigger: EffectTrigger,
	triggerValue: any,
}

export interface EffectSettings {
	type: EffectType,
	typeValue: any,
}
export interface Effect extends ISettingsSerialize<EffectSettings> {
	getType(): EffectType,
	apply(entity: IPhysics<SHAPE>, override?: Object): void
}

export interface IEffectable {
	effects: FullEffectSettings[]
}
