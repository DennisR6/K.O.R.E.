import { expect, test } from "bun:test";
import { EngineEffectRegistry, TRANSFORM_SWAP_POSITION_EFFECT_ID, registerTransformEffects } from "../src/engine/sdk/index.ts";

test("transform.swap-position is a JSON-safe stable-ID command", () => {
	const effects = registerTransformEffects(new EngineEffectRegistry());
	const command = { type: TRANSFORM_SWAP_POSITION_EFFECT_ID, target: { type: "entity", entityId: "first" }, typeValue: { otherEntityId: "second" } };
	expect(() => effects.validate(command)).not.toThrow();
	expect(() => effects.validate({ ...command, typeValue: { otherEntityId: "" } })).toThrow("non-empty");
});

test("transform.swap-position rejects extra payload state", () => {
	const effects = registerTransformEffects(new EngineEffectRegistry());
	expect(() => effects.validate({ type: TRANSFORM_SWAP_POSITION_EFFECT_ID, target: { type: "entity", entityId: "first" }, typeValue: { otherEntityId: "second", temporary: true } })).toThrow("unexpected");
});
