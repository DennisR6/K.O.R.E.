import {
	EffectType, EFFECT_SCHEMA_VERSION,
	ItemEffectType,
	SettingOperation,
	type EffectSettings,
	type FullEffectSettings,
	type ItemEffectSettings,
	type PlayerSettingKey,
} from "./types.js";
import { validateTriggerSettings } from "./triggerValidation.js";
import { validateResolvedEffectTarget } from "../item/resolvedTarget.js";

const CORE_EFFECT_KEYS = new Set(["schemaVersion", "type", "typeValue"]);
const FULL_EFFECT_KEYS = new Set(["schemaVersion", "type", "typeValue", "trigger", "triggerValue"]);
const ITEM_EFFECT_KEYS = new Set(["type", "typeValue", "itemId", "order"]);
	const PLAYER_SETTING_KEYS = new Set<PlayerSettingKey>(["hp", "mass", "size", "friction", "position", "velocity", "team", "physicsEnabled", "drawingEnabled"]);
	const STRUCTURE_SETTING_KEYS = new Set(["physicsEnabled", "drawingEnabled"]);
const CORE_EFFECT_TYPES = [EffectType.Physics, EffectType.NumericAdd, EffectType.Movement, EffectType.Multi, EffectType.ModifyMass, EffectType.ModifySize, EffectType.Position, EffectType.Velocity, EffectType.Team, EffectType.ModifySetting] as const;
const ITEM_EFFECT_TYPES = [ItemEffectType.ModifyForce, ItemEffectType.ModifyRotation, ItemEffectType.LockRotation, ItemEffectType.ApplyTorque, ItemEffectType.SpawnTrigger, ItemEffectType.Shield, ItemEffectType.GhostMode, ItemEffectType.SelectionLock, ItemEffectType.AimVariance, ItemEffectType.TemporalModifier, ItemEffectType.StructureLifecycle, ItemEffectType.DeferredEffect] as const;

/** Validates one serialized core effect without constructing a runtime object. */
export function validateEffectSettings(value: unknown): asserts value is EffectSettings {
	const effect = record(value, "Effect settings");
	knownKeys(effect, CORE_EFFECT_KEYS, "Effect settings");
	if (effect.schemaVersion !== EFFECT_SCHEMA_VERSION) throw new Error(`Unsupported Effect schema version: ${String(effect.schemaVersion)}`);
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
		case EffectType.NumericAdd:
			exactKeys(payload, ["stateId", "amount"], "Numeric add payload");
			if (typeof payload.stateId !== "string" || payload.stateId.length === 0) throw new Error("Numeric add stateId must be a non-empty string");
			finite(payload.amount, "Numeric add amount"); return;
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
	validateEffectSettings({ schemaVersion: full.schemaVersion, type: full.type, typeValue: full.typeValue });
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
			knownKeys(payload, new Set(["triggerId", "delayTurns", "structureId", "remainingTurns", "fired", "resolvedTarget", "resolvedPosition"]), "spawnTrigger payload"); requiredKeys(payload, ["triggerId", "delayTurns"], "spawnTrigger payload");
			string(payload.triggerId, "spawnTrigger triggerId"); boundedDelayTurns(payload.delayTurns, payload.remainingTurns, "spawnTrigger");
			if (payload.structureId !== undefined) string(payload.structureId, "spawnTrigger structureId");
			if (payload.resolvedTarget !== undefined) validateResolvedEffectTarget(payload.resolvedTarget);
			if (payload.resolvedPosition !== undefined) { const position = record(payload.resolvedPosition, "spawnTrigger resolvedPosition"); exactKeys(position, ["x", "y"], "spawnTrigger resolvedPosition"); finite(position.x, "spawnTrigger resolvedPosition x"); finite(position.y, "spawnTrigger resolvedPosition y"); }
			optionalBoolean(payload.fired, "spawnTrigger fired"); return;
		case ItemEffectType.DeferredEffect:
			exactKeys(payload, ["durationUnit", "duration", "effect"], "deferredEffect payload");
			if (payload.durationUnit !== "ticks") throw new Error("deferredEffect durationUnit must be ticks");
			boundedTurns(payload.duration, undefined, "deferredEffect");
			const deferred = record(payload.effect, "deferredEffect effect");
			exactKeys(deferred, ["schemaVersion", "type", "typeValue"], "deferredEffect effect");
			if (deferred.schemaVersion !== 1 || deferred.type !== "movement.apply-force-field") throw new Error("deferredEffect currently requires movement.apply-force-field");
			const field = record(deferred.typeValue, "deferredEffect force field");
			exactKeys(field, ["mode", "force", "range"], "deferredEffect force field");
			if (field.mode !== "attract" && field.mode !== "repel") throw new Error("deferredEffect force field mode is invalid");
			finiteNonNegative(field.force, "deferredEffect force field force");
			finitePositive(field.range, "deferredEffect force field range");
			return;
		case ItemEffectType.Shield:
			knownKeys(payload, new Set(["capacity", "remainingCapacity", "blocksCollision"]), "shield payload"); requiredKeys(payload, ["capacity"], "shield payload"); finitePositive(payload.capacity, "shield capacity");
			if (payload.remainingCapacity !== undefined && (typeof payload.remainingCapacity !== "number" || !Number.isFinite(payload.remainingCapacity) || payload.remainingCapacity < 0 || payload.remainingCapacity > payload.capacity)) throw new Error("shield remainingCapacity is outside capacity");
			optionalBoolean(payload.blocksCollision, "shield blocksCollision"); return;
		case ItemEffectType.StructureLifecycle:
			exactKeys(payload, ["durationUnit", "duration", "structure"], "structureLifecycle payload");
			if (payload.durationUnit !== "turns") throw new Error("structureLifecycle durationUnit must be turns");
			boundedTurns(payload.duration, undefined, "structureLifecycle");
			const structure = record(payload.structure, "structureLifecycle structure");
			knownKeys(structure, new Set(["type", "w", "h", "color", "role"]), "structureLifecycle structure");
			requiredKeys(structure, ["type", "w", "h"], "structureLifecycle structure");
			if (structure.type !== "rectangle") throw new Error("structureLifecycle currently requires rectangle geometry");
			finitePositive(structure.w, "structureLifecycle width"); finitePositive(structure.h, "structureLifecycle height");
			if (structure.color !== undefined) string(structure.color, "structureLifecycle color");
			if (structure.role !== undefined && !["solid", "containment", "both"].includes(String(structure.role))) throw new Error("structureLifecycle role is invalid");
			return;
		case ItemEffectType.GhostMode: knownKeys(payload, new Set(["durationTurns", "remainingTurns"]), "ghostMode payload"); requiredKeys(payload, ["durationTurns"], "ghostMode payload"); boundedTurns(payload.durationTurns, payload.remainingTurns, "ghostMode"); return;
		case ItemEffectType.AimVariance:
			knownKeys(payload, new Set(["maxVarianceDegrees", "seed", "randomState"]), "aimVariance payload"); requiredKeys(payload, ["maxVarianceDegrees"], "aimVariance payload"); finiteNonNegative(payload.maxVarianceDegrees, "aimVariance maxVarianceDegrees"); optionalSafeInteger(payload.seed, "aimVariance seed"); optionalSafeInteger(payload.randomState, "aimVariance randomState"); return;
		case ItemEffectType.TemporalModifier:
			exactKeys(payload, ["durationUnit", "duration", "effect"], "temporalModifier payload");
			if (payload.durationUnit !== "turns") throw new Error("temporalModifier durationUnit must be turns");
			boundedTurns(payload.duration, undefined, "temporalModifier");
			const temporalEffect = record(payload.effect, "temporalModifier effect");
			exactKeys(temporalEffect, ["schemaVersion", "type", "typeValue"], "temporalModifier effect");
			if (temporalEffect.schemaVersion !== 1 || temporalEffect.type !== "movement.scale-speed") throw new Error("temporalModifier currently requires movement.scale-speed");
			const scalePayload = record(temporalEffect.typeValue, "temporalModifier movement payload");
			exactKeys(scalePayload, ["factor"], "temporalModifier movement payload");
			finiteNonNegative(scalePayload.factor, "temporalModifier movement factor");
			return;
	}
}

function validateModifySetting(payload: Record<string, unknown>): void {
	exactKeys(payload, ["operation", "key", "value"], "ModifySetting payload");
	if (payload.operation !== SettingOperation.Set && payload.operation !== SettingOperation.Add && payload.operation !== SettingOperation.Remove) throw new Error("ModifySetting operation is invalid");
	if (typeof payload.key !== "string" || (!PLAYER_SETTING_KEYS.has(payload.key as PlayerSettingKey) && !STRUCTURE_SETTING_KEYS.has(payload.key))) throw new Error("ModifySetting key is not allowlisted");
	validateSettingValue(payload.key as PlayerSettingKey, payload.value);
}

function validateSettingValue(key: PlayerSettingKey, value: unknown): void {
	if (value === undefined) return;
	if (["hp", "mass", "size", "friction"].includes(key)) { finite(value, `ModifySetting ${key}`); return; }
	if (["position", "velocity"].includes(key)) { const vector = record(value, `ModifySetting ${key}`); exactKeys(vector, ["x", "y"], `ModifySetting ${key}`); finite(vector.x, `${key} x`); finite(vector.y, `${key} y`); return; }
	if (["physicsEnabled", "drawingEnabled"].includes(key)) { if (typeof value !== "boolean") throw new Error(`ModifySetting ${key} requires a boolean`); return; }
	if (key === "team") { if (!Array.isArray(value) || !value.every(team => Number.isSafeInteger(team) && team >= 0)) throw new Error("ModifySetting team requires non-negative integer teams"); return; }
	if (typeof value !== "boolean") throw new Error(`ModifySetting ${key} requires a boolean`);
}

function validateTurns(payload: Record<string, unknown>, label: string): void {
	knownKeys(payload, new Set(["durationTurns", "remainingTurns"]), `${label} payload`); requiredKeys(payload, ["durationTurns"], `${label} payload`); boundedTurns(payload.durationTurns, payload.remainingTurns, label);
}
function boundedTurns(duration: unknown, remaining: unknown, label: string): void { if (!Number.isSafeInteger(duration) || (duration as number) < 1) throw new Error(`${label} durationTurns must be a positive integer`); if (remaining !== undefined && (!Number.isSafeInteger(remaining) || (remaining as number) < 0 || (remaining as number) > (duration as number))) throw new Error(`${label} remainingTurns is outside durationTurns`); }
function boundedDelayTurns(duration: unknown, remaining: unknown, label: string): void { if (!Number.isSafeInteger(duration) || (duration as number) < 0) throw new Error(`${label} delayTurns must be a non-negative integer`); if (remaining !== undefined && (!Number.isSafeInteger(remaining) || (remaining as number) < 0 || (remaining as number) > (duration as number))) throw new Error(`${label} remainingTurns is outside delayTurns`); }
function record(value: unknown, label: string): Record<string, unknown> { if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`); return value as Record<string, unknown>; }
function knownKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void { for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${label} contains unknown field '${key}'`); }
function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void { const set = new Set(allowed); for (const key of Object.keys(value)) if (!set.has(key)) throw new Error(`${label} contains unknown field '${key}'`); for (const key of allowed) if (!(key in value)) throw new Error(`${label} is missing '${key}'`); }
function requiredKeys(value: Record<string, unknown>, required: readonly string[], label: string): void { for (const key of required) if (!(key in value)) throw new Error(`${label} is missing '${key}'`); }
function finite(value: unknown, label: string): asserts value is number { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite`); }
function finitePositive(value: unknown, label: string): asserts value is number { finite(value, label); if (value <= 0) throw new Error(`${label} must be positive`); }
function finiteNonNegative(value: unknown, label: string): asserts value is number { finite(value, label); if (value < 0) throw new Error(`${label} must be non-negative`); }
function string(value: unknown, label: string): asserts value is string { if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`); }
function optionalBoolean(value: unknown, label: string): void { if (value !== undefined && typeof value !== "boolean") throw new Error(`${label} must be boolean`); }
function optionalSafeInteger(value: unknown, label: string): void { if (value !== undefined && !Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`); }
