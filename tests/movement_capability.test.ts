import { expect, test } from "bun:test";
import { EngineEffectRegistry, EngineSystemRegistry, MOVEMENT_CAPABILITY, MOVEMENT_EFFECT_ID, registerMovementCommands, registerMovementEffect } from "../src/engine/sdk/index.ts";

test("the movement Effect declares its capability and validates its typed payload", () => {
	const effects = registerMovementEffect(new EngineEffectRegistry());

	expect(() => effects.validate({ type: MOVEMENT_EFFECT_ID, typeValue: { deltaTime: 1, x: 2, y: -3 } })).not.toThrow();
	expect(() => effects.validate({ type: MOVEMENT_EFFECT_ID, typeValue: { deltaTime: 1, x: 2, y: 0, extra: true } })).toThrow();
	expect(effects.describe()).toEqual([{
		id: MOVEMENT_EFFECT_ID,
		schemaVersion: 1,
		requiresCapability: [MOVEMENT_CAPABILITY],
		targetType: "entity",
		lifecycleCategory: "modifier",
	}]);
});

test("movement support is accepted only when a selected provider advertises the capability", () => {
	const effects = registerMovementEffect(new EngineEffectRegistry());
	const systems = new EngineSystemRegistry()
		.register({ id: "movement", provides: [MOVEMENT_CAPABILITY], acceptsEffects: [MOVEMENT_EFFECT_ID] })
		.register({ id: "unrelated" });
	const movementFramework = systems.select(["movement"]);
	const unrelatedFramework = systems.select(["unrelated"]);
	const movementEffect = [{ type: MOVEMENT_EFFECT_ID, typeValue: { deltaTime: 1, x: 0, y: 0 } }];

	expect(() => systems.validateEffectSupport(movementFramework, movementEffect, effects)).not.toThrow();
	expect(() => systems.validateEffectSupport(unrelatedFramework, movementEffect, effects)).toThrow(/accepts/);
});

test("movement commands validate typed velocity and speed-scale payloads", () => {
	const effects = registerMovementCommands(new EngineEffectRegistry());

	expect(() => effects.validate({ type: "movement.set-velocity", typeValue: { x: 20, y: -4 } })).not.toThrow();
	expect(() => effects.validate({ type: "movement.add-velocity", typeValue: { x: 2, y: 3 } })).not.toThrow();
	expect(() => effects.validate({ type: "movement.scale-speed", typeValue: { factor: 0 } })).not.toThrow();
	expect(() => effects.validate({ type: "movement.scale-speed", typeValue: { factor: -1 } })).toThrow();
	expect(() => effects.validate({ type: "movement.set-velocity", typeValue: { x: 1, y: 2, extra: true } })).toThrow();
});
