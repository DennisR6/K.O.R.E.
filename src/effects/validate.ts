import { assertJsonValue } from "../engine/contracts/systemSettings.js";
import {
	EffectType,
	ItemEffectType,
	SettingOperation,
	type EffectSettings,
	type FullEffectSettings,
	type ItemEffectSettings,
	type PlayerSettingKey,
} from "./types.js";
import { validateTriggerSettings } from "./triggerValidation.js";

const CORE_EFFECT_KEYS = new Set(["type", "typeValue"]);
const FULL_EFFECT_KEYS = new Set(["type", "typeValue", "trigger", "triggerValue"]);
const ITEM_EFFECT_KEYS = new Set(["type", "typeValue", "itemId", "order"]);
const PLAYER_SETTING_KEYS = new Set<PlayerSettingKey>(["hp", "mass", "size", "friction", "position", "velocity", "team", "dead", "physicsEnabled"]);
const CORE_EFFECT_TYPES = [EffectType.Physics, EffectType.Damage, EffectType.Movement, EffectType.Multi, EffectType.ModifyMass, EffectType.ModifySize, EffectType.Position, EffectType.Velocity, EffectType.Team, EffectType.ModifySetting] as const;
const ITEM_EFFECT_TYPES = [ItemEffectType.ModifyForce, ItemEffectType.ModifyRotation, ItemEffectType.LockRotation, ItemEffectType.ApplyTorque, ItemEffectType.SpawnTrigger, ItemEffectType.DelayedEffect, ItemEffectType.Shield, ItemEffectType.Freeze, ItemEffectType.SwapPosition, ItemEffectType.TemporaryWall, ItemEffectType.GhostMode, ItemEffectType.Magnet, ItemEffectType.SelectionLock, ItemEffectType.AimVariance] as const;

/** Validates one serialized core effect without constructing a runtime object. */
export function validateEffectSettings(value: unknown): asserts value is EffectSettings {
	const effect = record(value, "Effect settings");
	knownKeys(effect, CORE_EFFECT_KEYS, "Effect settings");
	if (!(CORE_EFFECT_TYPES as readonly unknown[]).includes(effect.type)) throw new Error(`Unknown effect type "${String(effect.type)}"`);
	if (effect.type === EffectType.Multi) {
		if (!Array.isArray(effect.typeValue)) throw new Error("EffectType.Multi requires a typeValue array of effect settings");
		effect.typeValue.forEach(validateEffectSettings);
		return;
	}
	const payload = record(effect.typeValue, `Effect '${String(effect.type)}' payload`);
	switch (effect.type) {
		case EffectType.Physics:
			exactKeys(payload, ["friction", "linearDrag", "stopThreshold"], "Physics payload");
			finite(payload.friction, "Physics friction"); finite(payload.linearDrag, "Physics linearDrag"); finite(payload.stopThreshold, "Physics stopThreshold"); return;
		case EffectType.Damage:
			exactKeys(payload, ["damage"], "Damage payload"); finiteNonNegative(payload.damage, "Damage amount"); return;
		case EffectType.Movement:
			exactKeys(payload, ["deltaTime", "x", "y"], "Movement payload"); finite(payload.deltaTime, "Movement deltaTime"); finite(payload.x, "Movement x"); finite(payload.y, "Movement y"); return;
		case EffectType.ModifyMass:
			exactKeys(payload, ["mass"], "Mass payload"); finitePositive(payload.mass, "Mass"); return;
		case EffectType.ModifySize:
			exactKeys(payload, ["size"], "Size payload"); finitePositive(payload.size, "Size"); return;
		case EffectType.Position:
		case EffectType.Velocity:
			exactKeys(payload, ["x", "y"], `${String(effect.type)} payload`); finite(payload.x, "Vector x"); finite(payload.y, "Vector y"); return;
		case EffectType.Team:
			exactKeys(payload, ["team"], "Team payload");
			if (!Array.isArray(payload.team) || !payload.team.every(team => Number.isSafeInteger(team) && team >= 0)) throw new Error("Team payload requires non-negative integer teams");
			return;
		case EffectType.ModifySetting:
			validateModifySetting(payload); return;
		default:
			throw new Error(`Unsupported effect type '${String(effect.type)}'`);
	}
}

/** Validates an effect plus its independently stored trigger metadata. */
export function validateFullEffectSettings(value: unknown): asserts value is FullEffectSettings {
	const full = record(value, "Full effect settings");
	knownKeys(full, FULL_EFFECT_KEYS, "Full effect settings");
	validateTriggerSettings({ trigger: full.trigger, triggerValue: full.triggerValue });
	validateEffectSettings({ type: full.type, typeValue: full.typeValue });
}

/** Validates persistent item-runtime state, not the looser item document input. */
export function validateRuntimeItemEffectSettings(value: unknown): asserts value is ItemEffectSettings {
	const effect = record(value, "Item effect settings");
	knownKeys(effect, ITEM_EFFECT_KEYS, "Item effect settings");
	if (effect.itemId !== undefined && (typeof effect.itemId !== "string" || effect.itemId.length === 0)) throw new Error("Item effect itemId must be a non-empty string");
	if (effect.order !== undefined && !Number.isSafeInteger(effect.order)) throw new Error("Item effect order must be a safe integer");
	if (!(ITEM_EFFECT_TYPES as readonly unknown[]).includes(effect.type)) throw new Error(`Unknown item effect type '${String(effect.type)}'`);
	const payload = record(effect.typeValue, `Item effect '${String(effect.type)}' payload`);
	switch (effect.type) {
		case ItemEffectType.ModifyForce: exactKeys(payload, ["factor"], "modifyForce payload"); finiteNonNegative(payload.factor, "modifyForce factor"); return;
		case ItemEffectType.ModifyRotation: exactKeys(payload, ["degrees"], "modifyRotation payload"); finite(payload.degrees, "modifyRotation degrees"); return;
		case ItemEffectType.LockRotation:
		case ItemEffectType.SelectionLock: validateTurns(payload, String(effect.type)); return;
		case ItemEffectType.ApplyTorque: exactKeys(payload, ["torque"], "applyTorque payload"); finite(payload.torque, "applyTorque torque"); return;
		case ItemEffectType.SpawnTrigger:
			knownKeys(payload, new Set(["triggerId", "delayTurns", "remainingTurns", "fired"]), "spawnTrigger payload"); requiredKeys(payload, ["triggerId", "delayTurns"], "spawnTrigger payload");
			string(payload.triggerId, "spawnTrigger triggerId"); boundedTurns(payload.delayTurns, payload.remainingTurns, "spawnTrigger"); optionalBoolean(payload.fired, "spawnTrigger fired"); return;
		case ItemEffectType.DelayedEffect:
			knownKeys(payload, new Set(["effectType", "effectValue", "delayTicks", "remainingTicks", "fired"]), "delayedEffect payload"); requiredKeys(payload, ["effectType", "delayTicks"], "delayedEffect payload");
			string(payload.effectType, "delayedEffect effectType"); boundedTicks(payload.delayTicks, payload.remainingTicks, "delayedEffect");
			if (payload.effectValue !== undefined) assertJsonValue(payload.effectValue); optionalBoolean(payload.fired, "delayedEffect fired"); return;
		case ItemEffectType.Shield:
			knownKeys(payload, new Set(["capacity", "remainingCapacity", "blocksCollision"]), "shield payload"); requiredKeys(payload, ["capacity"], "shield payload"); finitePositive(payload.capacity, "shield capacity");
			if (payload.remainingCapacity !== undefined && (typeof payload.remainingCapacity !== "number" || !Number.isFinite(payload.remainingCapacity) || payload.remainingCapacity < 0 || payload.remainingCapacity > payload.capacity)) throw new Error("shield remainingCapacity is outside capacity");
			optionalBoolean(payload.blocksCollision, "shield blocksCollision"); return;
		case ItemEffectType.Freeze:
			knownKeys(payload, new Set(["speedFactor", "durationTurns", "remainingTurns"]), "freeze payload"); requiredKeys(payload, ["speedFactor", "durationTurns"], "freeze payload"); finiteRange(payload.speedFactor, 0, 1, "freeze speedFactor"); boundedTurns(payload.durationTurns, payload.remainingTurns, "freeze"); return;
		case ItemEffectType.SwapPosition: exactKeys(payload, [], "swapPosition payload"); return;
		case ItemEffectType.TemporaryWall:
			knownKeys(payload, new Set(["wallId", "x", "y", "w", "h", "color", "durationTurns", "remainingTurns", "active"]), "temporaryWall payload"); requiredKeys(payload, ["wallId", "x", "y", "w", "h", "durationTurns"], "temporaryWall payload");
			string(payload.wallId, "temporaryWall wallId"); finite(payload.x, "temporaryWall x"); finite(payload.y, "temporaryWall y"); finitePositive(payload.w, "temporaryWall w"); finitePositive(payload.h, "temporaryWall h");
			if (payload.color !== undefined) string(payload.color, "temporaryWall color"); boundedTurns(payload.durationTurns, payload.remainingTurns, "temporaryWall"); optionalBoolean(payload.active, "temporaryWall active"); return;
		case ItemEffectType.GhostMode: knownKeys(payload, new Set(["durationTurns", "remainingTurns"]), "ghostMode payload"); requiredKeys(payload, ["durationTurns"], "ghostMode payload"); boundedTurns(payload.durationTurns, payload.remainingTurns, "ghostMode"); return;
		case ItemEffectType.Magnet:
			exactKeys(payload, ["mode", "force", "range"], "magnet payload"); if (payload.mode !== "attract" && payload.mode !== "repel") throw new Error("magnet mode must be attract or repel"); finiteNonNegative(payload.force, "magnet force"); finitePositive(payload.range, "magnet range"); return;
		case ItemEffectType.AimVariance:
			knownKeys(payload, new Set(["maxVarianceDegrees", "seed", "randomState"]), "aimVariance payload"); requiredKeys(payload, ["maxVarianceDegrees"], "aimVariance payload"); finiteNonNegative(payload.maxVarianceDegrees, "aimVariance maxVarianceDegrees"); optionalSafeInteger(payload.seed, "aimVariance seed"); optionalSafeInteger(payload.randomState, "aimVariance randomState"); return;
	}
}

function validateModifySetting(payload: Record<string, unknown>): void {
	exactKeys(payload, ["operation", "key", "value"], "ModifySetting payload");
	if (payload.operation !== SettingOperation.Set && payload.operation !== SettingOperation.Add && payload.operation !== SettingOperation.Remove) throw new Error("ModifySetting operation is invalid");
	if (typeof payload.key !== "string" || !PLAYER_SETTING_KEYS.has(payload.key as PlayerSettingKey)) throw new Error("ModifySetting key is not allowlisted");
	validateSettingValue(payload.key as PlayerSettingKey, payload.value);
}

function validateSettingValue(key: PlayerSettingKey, value: unknown): void {
	if (value === undefined) return;
	if (["hp", "mass", "size", "friction"].includes(key)) { finite(value, `ModifySetting ${key}`); return; }
	if (["position", "velocity"].includes(key)) { const vector = record(value, `ModifySetting ${key}`); exactKeys(vector, ["x", "y"], `ModifySetting ${key}`); finite(vector.x, `${key} x`); finite(vector.y, `${key} y`); return; }
	if (key === "team") { if (!Array.isArray(value) || !value.every(team => Number.isSafeInteger(team) && team >= 0)) throw new Error("ModifySetting team requires non-negative integer teams"); return; }
	if (typeof value !== "boolean") throw new Error(`ModifySetting ${key} requires a boolean`);
}

function validateTurns(payload: Record<string, unknown>, label: string): void {
	knownKeys(payload, new Set(["durationTurns", "remainingTurns"]), `${label} payload`); requiredKeys(payload, ["durationTurns"], `${label} payload`); boundedTurns(payload.durationTurns, payload.remainingTurns, label);
}
function boundedTurns(duration: unknown, remaining: unknown, label: string): void { if (!Number.isSafeInteger(duration) || (duration as number) < 1) throw new Error(`${label} durationTurns must be a positive integer`); if (remaining !== undefined && (!Number.isSafeInteger(remaining) || (remaining as number) < 0 || (remaining as number) > (duration as number))) throw new Error(`${label} remainingTurns is outside durationTurns`); }
function boundedTicks(duration: unknown, remaining: unknown, label: string): void { if (!Number.isSafeInteger(duration) || (duration as number) < 0) throw new Error(`${label} delayTicks must be a non-negative integer`); if (remaining !== undefined && (!Number.isSafeInteger(remaining) || (remaining as number) < 0 || (remaining as number) > (duration as number))) throw new Error(`${label} remainingTicks is outside delayTicks`); }
function record(value: unknown, label: string): Record<string, unknown> { if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`); return value as Record<string, unknown>; }
function knownKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void { for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${label} contains unknown field '${key}'`); }
function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void { const set = new Set(allowed); for (const key of Object.keys(value)) if (!set.has(key)) throw new Error(`${label} contains unknown field '${key}'`); for (const key of allowed) if (!(key in value)) throw new Error(`${label} is missing '${key}'`); }
function requiredKeys(value: Record<string, unknown>, required: readonly string[], label: string): void { for (const key of required) if (!(key in value)) throw new Error(`${label} is missing '${key}'`); }
function finite(value: unknown, label: string): asserts value is number { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite`); }
function finitePositive(value: unknown, label: string): asserts value is number { finite(value, label); if (value <= 0) throw new Error(`${label} must be positive`); }
function finiteNonNegative(value: unknown, label: string): asserts value is number { finite(value, label); if (value < 0) throw new Error(`${label} must be non-negative`); }
function finiteRange(value: unknown, min: number, max: number, label: string): asserts value is number { finite(value, label); if (value < min || value > max) throw new Error(`${label} is outside range`); }
function string(value: unknown, label: string): asserts value is string { if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`); }
function optionalBoolean(value: unknown, label: string): void { if (value !== undefined && typeof value !== "boolean") throw new Error(`${label} must be boolean`); }
function optionalSafeInteger(value: unknown, label: string): void { if (value !== undefined && !Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`); }
