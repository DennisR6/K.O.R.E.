import type { ISettingsSerialize } from "../engine/types.js";
import type { IPhysics, SHAPE } from "../physics/physics.js";
import type { FrictionSettings } from "../settings/settings.js";
import type { Vector2D } from "../physics/physics.js";

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
	ModifySetting = "EffectType.ModifySetting",
	RespawningPosition = "EffectType.RespawningPosition"
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
	Magnet = "magnet",
	SelectionLock = "selectionLock",
	AimVariance = "aimVariance",
}
export const enum EffectTrigger {
	Always = "EffectTrigger.Always",
	Collision = "EffectTrigger.Collision",
	Round = "EffectTrigger.Round"
}

export interface EffectMovePayload extends Vector2D {
	deltaTime: number;
}

export interface EffectMultiPayload {
	children: EffectSettings[];
}

/** Payloads for the serialized core EffectType discriminant. */
export interface EffectPayloadMap {
	[EffectType.Physics]: FrictionSettings;
	[EffectType.Damage]: { damage: number };
	[EffectType.Movement]: EffectMovePayload;
	[EffectType.Multi]: EffectSettings[];
	[EffectType.ModifyMass]: { mass: number };
	[EffectType.ModifySize]: { size: number };
	[EffectType.Position]: Vector2D;
	[EffectType.Velocity]: Vector2D;
	[EffectType.Team]: { team: number[] };
	[EffectType.ModifySetting]: ModifySettingValue;
	/** Reserved until a runtime implementation and payload are defined. */
	[EffectType.RespawningPosition]: never;
}

/** Payloads for serialized item-runtime effects. */
export interface ItemEffectPayloadMap {
	[ItemEffectType.ModifyForce]: { factor: number };
	[ItemEffectType.ModifyRotation]: { degrees: number };
	[ItemEffectType.LockRotation]: LockRotationPayload;
	[ItemEffectType.ApplyTorque]: { torque: number };
	[ItemEffectType.SpawnTrigger]: SpawnTriggerPayload;
	[ItemEffectType.DelayedEffect]: DelayedEffectPayload;
	[ItemEffectType.Shield]: ShieldPayload;
	[ItemEffectType.Freeze]: FreezePayload;
	[ItemEffectType.SwapPosition]: Record<string, never>;
	[ItemEffectType.TemporaryWall]: TemporaryWallPayload;
	[ItemEffectType.GhostMode]: GhostModePayload;
	[ItemEffectType.Magnet]: { mode: "attract" | "repel"; force: number; range: number };
	[ItemEffectType.SelectionLock]: LockRotationPayload;
	[ItemEffectType.AimVariance]: { maxVarianceDegrees: number; seed?: number; randomState?: number };
}

export interface LockRotationPayload {
	durationTurns: number;
	remainingTurns?: number;
}

export interface SpawnTriggerPayload {
	triggerId: string;
	delayTurns: number;
	remainingTurns?: number;
	fired?: boolean;
}

export interface DelayedEffectPayload {
	effectType: string;
	effectValue?: Record<string, unknown>;
	delayTicks: number;
	remainingTicks?: number;
	fired?: boolean;
}

export interface ShieldPayload {
	capacity: number;
	remainingCapacity?: number;
	blocksCollision?: boolean;
}

export interface FreezePayload {
	speedFactor: number;
	durationTurns: number;
	remainingTurns?: number;
}

export interface GhostModePayload {
	durationTurns: number;
	remainingTurns?: number;
}

export interface TemporaryWallPayload {
	wallId: string;
	x: number;
	y: number;
	w: number;
	h: number;
	color?: string;
	durationTurns: number;
	remainingTurns?: number;
	active?: boolean;
}

export type EffectSettings = {
	[K in Exclude<EffectType, EffectType.RespawningPosition>]: { type: K; typeValue: EffectPayloadMap[K] }
}[Exclude<EffectType, EffectType.RespawningPosition>];

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

export type FullEffectSettings = EffectSettings & {
	trigger: EffectTrigger,
	triggerValue: unknown,
}
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
