import { expect, test } from "bun:test";
import { EngineEffectRegistry, EngineSystemRegistry, TRANSFORM_CAPABILITY, TRANSFORM_SET_POSITION_EFFECT_ID, TRANSFORM_SET_ROTATION_EFFECT_ID, TRANSFORM_SWAP_POSITION_EFFECT_ID, registerTransformEffects } from "@coffeemakerstudio/roast";

test("transform commands declare a capability and validate typed absolute payloads", () => {
	const effects = registerTransformEffects(new EngineEffectRegistry());

	expect(() => effects.validate({ type: TRANSFORM_SET_POSITION_EFFECT_ID, typeValue: { x: 20, y: 40 } })).not.toThrow();
	expect(() => effects.validate({ type: TRANSFORM_SET_ROTATION_EFFECT_ID, typeValue: { rotation: 90 } })).not.toThrow();
	expect(() => effects.validate({ type: TRANSFORM_SET_POSITION_EFFECT_ID, typeValue: { x: 20, y: 40, extra: true } })).toThrow();
	expect(() => effects.validate({ type: TRANSFORM_SET_ROTATION_EFFECT_ID, typeValue: { rotation: Number.NaN } })).toThrow();
	expect(() => effects.validate({ type: TRANSFORM_SWAP_POSITION_EFFECT_ID, target: { type: "entity", entityId: "first" }, typeValue: { otherEntityId: "second" } })).not.toThrow();
	expect(() => effects.validate({ type: TRANSFORM_SWAP_POSITION_EFFECT_ID, target: { type: "entity", entityId: "first" }, typeValue: { otherEntityId: "" } })).toThrow();
	expect(effects.describe()).toEqual([
		{ id: TRANSFORM_SET_POSITION_EFFECT_ID, schemaVersion: 1, requiresCapability: [TRANSFORM_CAPABILITY], targetType: "entity-or-structure", lifecycleCategory: "command" },
		{ id: TRANSFORM_SET_ROTATION_EFFECT_ID, schemaVersion: 1, requiresCapability: [TRANSFORM_CAPABILITY], targetType: "entity", lifecycleCategory: "command" },
		{ id: TRANSFORM_SWAP_POSITION_EFFECT_ID, schemaVersion: 1, requiresCapability: [TRANSFORM_CAPABILITY], targetType: "entity", lifecycleCategory: "command" },
	]);
});

test("transform commands require a selected provider that accepts both commands", () => {
	const effects = registerTransformEffects(new EngineEffectRegistry());
	const systems = new EngineSystemRegistry()
		.register({ id: "transform", provides: [TRANSFORM_CAPABILITY], acceptsEffects: [TRANSFORM_SET_POSITION_EFFECT_ID, TRANSFORM_SET_ROTATION_EFFECT_ID, TRANSFORM_SWAP_POSITION_EFFECT_ID] })
		.register({ id: "unrelated" });
	const transformFramework = systems.select(["transform"]);
	const unrelatedFramework = systems.select(["unrelated"]);
	const commands = [
		{ type: TRANSFORM_SET_POSITION_EFFECT_ID, typeValue: { x: 1, y: 2 } },
		{ type: TRANSFORM_SET_ROTATION_EFFECT_ID, typeValue: { rotation: 30 } },
		{ type: TRANSFORM_SWAP_POSITION_EFFECT_ID, target: { type: "entity", entityId: "first" }, typeValue: { otherEntityId: "second" } },
	];

	expect(() => systems.validateEffectSupport(transformFramework, commands, effects)).not.toThrow();
	expect(() => systems.validateEffectSupport(unrelatedFramework, commands, effects)).toThrow(/accepts/);
});
