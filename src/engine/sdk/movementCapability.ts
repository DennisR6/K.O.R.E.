import type { EngineEffectRegistry } from "./effectRegistry.js";

export const MOVEMENT_CAPABILITY = "movement.state" as const;
export const MOVEMENT_EFFECT_ID = "movement.integrate" as const;

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
