import type { EngineEffectRegistry } from "./effectRegistry.js";

export const MOVEMENT_CAPABILITY = "movement.state" as const;
export const MOVEMENT_EFFECT_ID = "movement.integrate" as const;
export const MOVEMENT_SET_VELOCITY_EFFECT_ID = "movement.set-velocity" as const;
export const MOVEMENT_ADD_VELOCITY_EFFECT_ID = "movement.add-velocity" as const;
export const MOVEMENT_SCALE_SPEED_EFFECT_ID = "movement.scale-speed" as const;

export interface MovementVelocityPayload {
	x: number;
	y: number;
}

export interface MovementScaleSpeedPayload {
	factor: number;
}

/** Registers the generic movement contract without selecting its runtime system. */
export function registerMovementEffect(registry: EngineEffectRegistry): EngineEffectRegistry {
	return registry.register({
		id: MOVEMENT_EFFECT_ID,
		requiresCapability: [MOVEMENT_CAPABILITY],
		targetType: "entity",
		lifecycleCategory: "modifier",
		validatePayload: payload => {
			if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Movement payload must be an object");
			const value = payload as Record<string, unknown>;
			if (Object.keys(value).some(key => !["deltaTime", "x", "y"].includes(key)) || Object.keys(value).length !== 3) throw new Error("Movement payload contains unexpected fields");
			for (const key of ["deltaTime", "x", "y"]) if (typeof value[key] !== "number" || !Number.isFinite(value[key])) throw new Error(`Movement ${key} must be finite`);
		},
	});
}

/** Registers deterministic movement commands without selecting their runtime system. */
export function registerMovementCommands(registry: EngineEffectRegistry): EngineEffectRegistry {
	return registry
		.register({
			id: MOVEMENT_SET_VELOCITY_EFFECT_ID,
			requiresCapability: [MOVEMENT_CAPABILITY],
			targetType: "entity",
			lifecycleCategory: "command",
			validatePayload: payload => validateVectorPayload(payload, "Movement velocity"),
		})
		.register({
			id: MOVEMENT_ADD_VELOCITY_EFFECT_ID,
			requiresCapability: [MOVEMENT_CAPABILITY],
			targetType: "entity",
			lifecycleCategory: "command",
			validatePayload: payload => validateVectorPayload(payload, "Movement velocity delta"),
		})
		.register({
			id: MOVEMENT_SCALE_SPEED_EFFECT_ID,
			requiresCapability: [MOVEMENT_CAPABILITY],
			targetType: "entity",
			lifecycleCategory: "command",
			validatePayload: payload => {
				const value = record(payload, "Movement speed scale payload");
				exactKeys(value, ["factor"], "Movement speed scale payload");
				if (typeof value.factor !== "number" || !Number.isFinite(value.factor) || value.factor < 0) throw new Error("Movement speed scale factor must be finite and non-negative");
			},
		});
}

function validateVectorPayload(payload: unknown, label: string): void {
	const value = record(payload, `${label} payload`);
	exactKeys(value, ["x", "y"], `${label} payload`);
	for (const key of ["x", "y"]) if (typeof value[key] !== "number" || !Number.isFinite(value[key])) throw new Error(`${label} ${key} must be finite`);
}

function record(value: unknown, label: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
	return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
	const allowed = new Set(keys);
	for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${label} contains unexpected fields`);
	for (const key of keys) if (!(key in value)) throw new Error(`${label} is missing '${key}'`);
}
