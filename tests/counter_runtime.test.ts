import { expect, test } from "bun:test";
import { createRuntimeHandler } from "../src/engine/runtimeFactory.ts";
import { COUNTER_ADD_EFFECT_ID, COUNTER_RESET_EFFECT_ID, COUNTER_SET_EFFECT_ID } from "../src/engine/sdk/index.ts";
import { CounterSystem } from "../src/systems/CounterSystem.ts";
import { createCanonicalPlayableMatchHandler } from "../src/settings/canonicalPlayableMatch.ts";

const target = { type: "counter" as const, counterId: "team-0-score" };

test("counter mutations live in canonical state and survive snapshot restore", () => {
	const handler = createCanonicalPlayableMatchHandler();
	handler.addSystem(new CounterSystem());
	const initial = handler.toSettings();
	initial.counters.push({ schemaVersion: 1, id: target.counterId, value: 0 });
	const runtime = createRuntimeHandler(initial);
	runtime.dispatchEngineEffect({ schemaVersion: 1, type: COUNTER_SET_EFFECT_ID, target, typeValue: { value: 5 } });
	runtime.dispatchEngineEffect({ schemaVersion: 1, type: COUNTER_ADD_EFFECT_ID, target, typeValue: { amount: -2 } });
	expect(runtime.getCounter(target.counterId)).toEqual({ schemaVersion: 1, id: target.counterId, value: 3 });

	const restored = createRuntimeHandler(runtime.toSettings());
	expect(restored.getCounters()).toContainEqual({ schemaVersion: 1, id: target.counterId, value: 3 });
	restored.dispatchEngineEffect({ schemaVersion: 1, type: COUNTER_RESET_EFFECT_ID, target, typeValue: {} });
	expect(restored.getCounter(target.counterId).value).toBe(0);
});

test("counter mutations reject unknown targets deterministically", () => {
	const handler = createCanonicalPlayableMatchHandler();
	handler.addSystem(new CounterSystem());
	expect(() => handler.dispatchEngineEffect({ schemaVersion: 1, type: COUNTER_ADD_EFFECT_ID, target: { type: "counter", counterId: "missing" }, typeValue: { amount: 1 } })).toThrow("Unknown counter target");
});
