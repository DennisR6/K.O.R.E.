import type { EngineEffectRegistry } from "./effectRegistry.js";

export const TRANSFORM_CAPABILITY = "transform.state" as const;
export const TRANSFORM_SET_POSITION_EFFECT_ID = "transform.set-position" as const;
export const TRANSFORM_SET_ROTATION_EFFECT_ID = "transform.set-rotation" as const;

export interface TransformSetPositionPayload {
	x: number;
	y: number;
}

export interface TransformSetRotationPayload {
	rotation: number;
}

/** Registers absolute transform commands without selecting their runtime system. */
export function registerTransformEffects(registry: EngineEffectRegistry): EngineEffectRegistry {
	return registry
		.register({
			id: TRANSFORM_SET_POSITION_EFFECT_ID,
			requiresCapability: [TRANSFORM_CAPABILITY],
			targetType: "entity",
			lifecycleCategory: "command",
			validatePayload: payload => validateVectorPayload(payload, "Transform position"),
		})
		.register({
			id: TRANSFORM_SET_ROTATION_EFFECT_ID,
			requiresCapability: [TRANSFORM_CAPABILITY],
			targetType: "entity",
			lifecycleCategory: "command",
			validatePayload: payload => {
				const value = record(payload, "Transform rotation payload");
				exactKeys(value, ["rotation"], "Transform rotation payload");
				finite(value.rotation, "Transform rotation");
			},
		});
}

function validateVectorPayload(payload: unknown, label: string): void {
	const value = record(payload, `${label} payload`);
	exactKeys(value, ["x", "y"], `${label} payload`);
	finite(value.x, `${label} x`);
	finite(value.y, `${label} y`);
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

function finite(value: unknown, label: string): asserts value is number {
	if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite`);
}
