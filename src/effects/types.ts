import type { ISettingsSerialize } from "../kore/runtime/types.js";
import type { IPhysics, SHAPE, Vector2D } from "@coffeemakerstudio/bean";
import type { FrictionSettings } from "../settings/settings.js";
import type { ResolvedEffectTarget } from "../item/resolvedTarget.js";

export const enum EffectType {
	Physics = "EffectType.Physics",
	NumericAdd = "numeric.add",
	Movement = "EffectType.Movement",
	Multi = "EffectType.Multi",
	ModifyMass = "EffectType.ModifyMass",
	ModifySize = "EffectType.ModifySize",
	Position = "EffectType.Position",
	Velocity = "EffectType.Velocity",
	Team = "EffectType.Team",
	ModifySetting = "EffectType.ModifySetting"
}
export const EFFECT_SCHEMA_VERSION = 1 as const;
/** Data-addressable effects that modify an item action before it is applied. */
export const enum ItemEffectType {
	ModifyForce = "modifyForce",
	ModifyRotation = "modifyRotation",
	LockRotation = "lockRotation",
	ApplyTorque = "applyTorque",
	SpawnTrigger = "spawnTrigger",
	DeferredEffect = "deferredEffect",
	Shield = "shield",
	StructureLifecycle = "structureLifecycle",
	GhostMode = "ghostMode",
	SelectionLock = "selectionLock",
	AimVariance = "aimVariance",
	TemporalModifier = "temporalModifier",
}
export const enum EffectTrigger {
	Always = "EffectTrigger.Always",
	Collision = "EffectTrigger.Collision",
	Round = "EffectTrigger.Round"
}

/** Payloads owned by Trigger contracts, independent of any Effect type. */
export interface TriggerPayloadMap {
	[EffectTrigger.Always]: [];
	[EffectTrigger.Collision]: [];
	[EffectTrigger.Round]: [];
}

export type TriggerSettings = {
	[K in EffectTrigger]: { trigger: K; triggerValue: TriggerPayloadMap[K] }
}[EffectTrigger];

export interface EffectMovePayload extends Vector2D {
	deltaTime: number;
}

/** Payloads for the serialized core EffectType discriminant. */
export interface EffectPayloadMap {
	[EffectType.Physics]: FrictionSettings;
	[EffectType.NumericAdd]: { stateId: string; amount: number };
	[EffectType.Movement]: EffectMovePayload;
	[EffectType.Multi]: EffectSettings[];
	[EffectType.ModifyMass]: { mass: number };
	[EffectType.ModifySize]: { size: number };
	[EffectType.Position]: Vector2D;
	[EffectType.Velocity]: Vector2D;
	[EffectType.Team]: { team: number[] };
	[EffectType.ModifySetting]: ModifySettingValue;
}

/** Payloads for serialized item-runtime effects. */
export interface ItemEffectPayloadMap {
	[ItemEffectType.ModifyForce]: { factor: number };
	[ItemEffectType.ModifyRotation]: { degrees: number };
	[ItemEffectType.LockRotation]: LockRotationPayload;
	[ItemEffectType.ApplyTorque]: { torque: number };
	[ItemEffectType.SpawnTrigger]: SpawnTriggerPayload;
	[ItemEffectType.DeferredEffect]: { durationUnit: "ticks"; duration: number; effect: Record<string, unknown> };
	[ItemEffectType.Shield]: ShieldPayload;
	[ItemEffectType.StructureLifecycle]: { durationUnit: "turns"; duration: number; structure: Record<string, unknown> };
	[ItemEffectType.GhostMode]: GhostModePayload;
	[ItemEffectType.SelectionLock]: LockRotationPayload;
	[ItemEffectType.AimVariance]: { maxVarianceDegrees: number; seed?: number; randomState?: number };
	[ItemEffectType.TemporalModifier]: { durationUnit: "turns"; duration: number; effect: Record<string, unknown> };
}

export interface LockRotationPayload {
	durationTurns: number;
	remainingTurns?: number;
}

export interface SpawnTriggerPayload {
	triggerId: string;
	delayTurns: number;
	structureId?: string;
	remainingTurns?: number;
	fired?: boolean;
	resolvedTarget?: ResolvedEffectTarget;
	resolvedPosition?: Vector2D;
}

export interface ShieldPayload {
	capacity: number;
	remainingCapacity?: number;
	blocksCollision?: boolean;
}

export interface GhostModePayload {
	durationTurns: number;
	remainingTurns?: number;
}

export type EffectSettings = {
	[K in EffectType]: { schemaVersion: typeof EFFECT_SCHEMA_VERSION; type: K; typeValue: EffectPayloadMap[K] }
}[EffectType];

/** Existing item authoring/runtime boundary; payload validation is added in Phase 1.3. */
export interface ItemEffectSettings {
	type: ItemEffectType;
	typeValue: Record<string, unknown>;
	itemId?: string;
	order?: number;
}

/** Typed runtime payload mapping used by validators and future narrow APIs. */
export type TypedItemEffectSettings = {
	[K in ItemEffectType]: {
		type: K;
		typeValue: ItemEffectPayloadMap[K];
		itemId?: string;
		order?: number;
	}
	}[ItemEffectType];

/** Composition boundary for independent Effect and Trigger contracts. */
export type FullEffectSettings = EffectSettings & TriggerSettings;
export interface ForceInput {
	angle: number;
	power: number;
}
export interface AngularState {
	rotation: number;
	angularVelocity: number;
}
export const enum SettingOperation {
	Set = "set",
	Add = "add",
	Remove = "remove",
}

export type PlayerSettingKey = "hp" | "mass" | "size" | "friction" | "position" | "velocity" | "team" | "physicsEnabled" | "drawingEnabled";
export type StructureSettingKey = "physicsEnabled" | "drawingEnabled";
export type SettingKey = PlayerSettingKey | StructureSettingKey;
export type SettingValue = number | boolean | number[] | { x: number, y: number } | undefined;
export interface ModifySettingValue {
	operation: SettingOperation;
	key: SettingKey;
	value: SettingValue;
}
export interface Effect extends ISettingsSerialize<EffectSettings> {
	getType(): EffectType,
	apply(entity: IPhysics<SHAPE>, override?: Object): void
}

export interface IEffectable {
	effects: FullEffectSettings[]
}
