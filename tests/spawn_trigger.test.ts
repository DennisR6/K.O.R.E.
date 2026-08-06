import { expect, test } from "bun:test";
import { EffectSpawnTrigger } from "../src/effects/spawnTrigger.ts";
import { ItemEffectType } from "../src/effects/types.ts";

test("spawnTrigger fires once after its deterministic delay", () => {
	const trigger = new EffectSpawnTrigger({ typeValue: { triggerId: "mine", delayTurns: 2 } });
	expect(trigger.advanceTurn()).toBe(false);
	expect(trigger.hasFired()).toBe(false);
	expect(trigger.advanceTurn()).toBe(true);
	expect(trigger.hasFired()).toBe(true);
	expect(trigger.advanceTurn()).toBe(false);
});

test("spawnTrigger restores countdown and fired state from snapshot data", () => {
	const trigger = new EffectSpawnTrigger({ typeValue: { triggerId: "wall", delayTurns: 3 } });
	trigger.advanceTurn();
	const settings = trigger.toSettings();
	expect(settings).toEqual({ type: ItemEffectType.SpawnTrigger, typeValue: { triggerId: "wall", delayTurns: 3, remainingTurns: 2, fired: false } });
	const restored = new EffectSpawnTrigger(settings);
	expect(restored.advanceTurn()).toBe(false);
	expect(restored.advanceTurn()).toBe(true);
});

test("spawnTrigger validates identifiers, delays, and restored state", () => {
	expect(() => new EffectSpawnTrigger({ typeValue: { triggerId: "", delayTurns: 1 } })).toThrow("triggerId");
	expect(() => new EffectSpawnTrigger({ typeValue: { triggerId: "mine", delayTurns: -1 } })).toThrow("non-negative");
	expect(() => new EffectSpawnTrigger({ typeValue: { triggerId: "mine", delayTurns: 1, remainingTurns: 2 } })).toThrow("between zero");
	expect(() => new EffectSpawnTrigger({ typeValue: { triggerId: "mine", delayTurns: 1, remainingTurns: 1, fired: true } })).toThrow("zero remaining");
});
