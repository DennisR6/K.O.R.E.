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
	Team = "EffectType.Team",
	ModifySetting = "EffectType.ModifySetting"
}
/** Data-addressable effects that modify an item action before it is applied. */
export const enum ItemEffectType {
	ModifyForce = "modifyForce",
	ModifyRotation = "modifyRotation",
	LockRotation = "lockRotation",
	ApplyTorque = "applyTorque",
	SpawnTrigger = "spawnTrigger",
	DelayedEffect = "delayedEffect",
	Shield = "shield",
	Freeze = "freeze",
	SwapPosition = "swapPosition",
	TemporaryWall = "temporaryWall",
	GhostMode = "ghostMode",
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
export interface ForceInput {
	angle: number;
	power: number;
}
export interface AngularState {
	rotation: number;
	angularVelocity: number;
}
export interface ItemEffectSettings {
	type: ItemEffectType;
	typeValue: Record<string, unknown>;
}
export const enum SettingOperation {
	Set = "set",
	Add = "add",
	Remove = "remove",
}

export type PlayerSettingKey = "hp" | "mass" | "size" | "friction" | "position" | "velocity" | "team" | "dead" | "physicsEnabled";
export type SettingValue = number | boolean | number[] | { x: number, y: number } | undefined;
export interface ModifySettingValue {
	operation: SettingOperation;
	key: PlayerSettingKey;
	value: SettingValue;
}
export interface Effect extends ISettingsSerialize<EffectSettings> {
	getType(): EffectType,
	apply(entity: IPhysics<SHAPE>, override?: Object): void
}

export interface IEffectable {
	effects: FullEffectSettings[]
}
