import { expect, test } from "bun:test";
import { DelayedHazardTrigger } from "../src/hazards/delayedTrigger.ts";

test("delayed hazards fire once after their configured simulation ticks and restore countdowns", () => {
	const trigger = new DelayedHazardTrigger(2);
	trigger.trigger();
	trigger.trigger();
	expect(trigger.tick()).toBe(false);
	const restored = DelayedHazardTrigger.fromSettings(trigger.toSettings());
	expect(restored.tick()).toBe(true);
	expect(restored.tick()).toBe(false);
	expect(() => new DelayedHazardTrigger(-1)).toThrow("non-negative integer ticks");
});
