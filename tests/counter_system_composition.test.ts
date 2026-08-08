import { expect, test } from "bun:test";
import { createRoundStartTriggerEvent } from "../src/engine/sdk/trigger.ts";
import { COUNTER_ADD_EFFECT_ID, COUNTER_RESET_EFFECT_ID, COUNTER_SET_EFFECT_ID } from "../src/engine/sdk/index.ts";
import { CounterSystem } from "../src/systems/CounterSystem.ts";
import { createCanonicalPlayableMatchHandler } from "../src/settings/canonicalPlayableMatch.ts";

test("counter commands preserve declaration order and compose with triggers", () => {
	const handler = createCanonicalPlayableMatchHandler();
	const system = new CounterSystem();
	const context = handler.getContext();
	context.counters.push({ schemaVersion: 1, id: "round-wins", value: 0 });
	const target = { type: "counter" as const, counterId: "round-wins" };
	system.applyEffects(context, [
		{ schemaVersion: 1, type: COUNTER_SET_EFFECT_ID, target, typeValue: { value: 2 } },
		{ schemaVersion: 1, type: COUNTER_ADD_EFFECT_ID, target, typeValue: { amount: 3 } },
		{ schemaVersion: 1, type: COUNTER_RESET_EFFECT_ID, target, typeValue: {} },
		{ schemaVersion: 1, type: COUNTER_ADD_EFFECT_ID, target, typeValue: { amount: 1 } },
	]);
	expect(context.counters[0]!.value).toBe(1);
	system.applyTriggered(context, [{ trigger: "round.start", effect: { schemaVersion: 1, type: COUNTER_ADD_EFFECT_ID, target, typeValue: { amount: 2 } } }], createRoundStartTriggerEvent({ sourceId: "test", sequence: 0, turnNumber: 0, activeTeam: 0, phase: "physics" }));
	expect(context.counters[0]!.value).toBe(3);
});
