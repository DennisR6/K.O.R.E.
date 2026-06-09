// import type { ISettingsSerialize } from "../engine/types";
// import type { SHAPE } from "../physics/physics";
// export interface IBaseEffect {
// 	type: EffectType
// 	trigger: EffectTrigger
// 	apply({ entity }: { entity: SHAPE }): void
// 	resetEffect(): void
// 	getEffectType(): EffectType
// 	getEffectTrigger(): EffectTrigger
// }
// export const enum EffectType { None, Physics, Damage }
// export type EffectCallBack = ({ type }: { type: EffectType }) => void;
// export const enum EffectTrigger { RoundBased, Collision, Always }
//
// export function getEffectTypeName(effectType: EffectType): string {
// 	switch (effectType) {
// 		case EffectType.Damage: return "damage"
// 		case EffectType.Physics: return "physics"
// 		default: return `EffectTypeTranslation not Implemented ${effectType}`
// 	}
// }
//
// export interface IEffectNone { apply({ entity }: { entity: SHAPE }): void }
// export interface IEffectDamage { apply({ entity }: { entity: SHAPE }): void }
// export interface IEffectWall { apply({ entity }: { entity: SHAPE }): void }
// export interface IEffectAlways { apply({ entity }: { entity: SHAPE }): void }
//
//
// export type Effect = IBaseEffect & EffectType & EffectTrigger & ISettingsSerialize<Effect>

import type { SHAPE } from "../physics/physics";

export const enum EffectType {
	Physics,
	Damage,
}
export const enum EffectTrigger {
	Always,
	Collision,
	Round,
}

export interface EffectSettings {
	type: EffectType,
	trigger: EffectTrigger,
	typeValue: {},
	triggerValue: {},
}

export interface Effect {
	getType(): EffectType,
	getTrigger(): EffectTrigger,
	apply(entity: SHAPE): void
}
