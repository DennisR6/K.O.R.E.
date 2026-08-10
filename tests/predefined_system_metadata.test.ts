import { expect, test } from "bun:test";
import { counterSystemDefinition, COUNTER_EFFECT_IDS, movementSystemDefinition, MOVEMENT_COMMAND_EFFECT_IDS } from "../src/engine/sdk/index.ts";
import { CounterSystem } from "../src/systems/CounterSystem.ts";
import { MovementSystem } from "../src/systems/MovementSystem.ts";

test("runtime acceptance and system metadata share the canonical command sets", () => {
	const counterDefinition = counterSystemDefinition();
	const movementDefinition = movementSystemDefinition();
	expect(counterDefinition.acceptsEffects).toEqual([...COUNTER_EFFECT_IDS]);
	expect(movementDefinition.acceptsEffects).toEqual([...MOVEMENT_COMMAND_EFFECT_IDS]);
	const counter = new CounterSystem();
	const movement = new MovementSystem();
	for (const effectId of COUNTER_EFFECT_IDS) expect(counter.acceptsEffect(effectId)).toBe(true);
	for (const effectId of MOVEMENT_COMMAND_EFFECT_IDS) expect(movement.acceptsEffect(effectId)).toBe(true);
	expect(counter.acceptsEffect("counter.unknown")).toBe(false);
	expect(movement.acceptsEffect("movement.unknown")).toBe(false);
});
