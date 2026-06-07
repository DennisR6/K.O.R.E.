import type { SHAPE } from "../physics/physics";
export interface IBaseEffect {
	apply({ entity }: { entity: SHAPE }): void
	resetEffect(): void
	getEffectType(): EffectType
	getEffectTrigger(): EffectTrigger
}
export const enum EffectType { None, Physics, Damage }
export type EffectCallBack = ({ type }: { type: EffectType }) => void;
export const enum EffectTrigger { RoundBased, Collision }

export function getEffectTypeName(effectType: EffectType): string {
	switch (effectType) {
		case EffectType.Damage: return "damage"
		case EffectType.Physics: return "physics"
		default: return `EffectTypeTranslation not Implemented ${effectType}`
	}
}

export type IEffectType = IEffectDamage | IEffectWall | IEffectNone
export interface IEffectNone { apply({ entity }: { entity: SHAPE }): void }
export interface IEffectDamage { apply({ entity }: { entity: SHAPE }): void }
export interface IEffectWall { apply({ entity }: { entity: SHAPE }): void }


export type Effect = EffectType & EffectTrigger & IBaseEffect 
