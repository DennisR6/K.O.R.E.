import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameSettings, validateDrift } from "../src/settings/settings.ts";

test("map drift accepts finite unit-range factors", () => {
	expect(() => validateDrift(0)).not.toThrow();
	expect(() => validateDrift(1)).not.toThrow();
	expect(() => validateDrift(-0.01)).toThrow("Map drift must be a finite number between 0 and 1");
	expect(() => validateDrift(1.01)).toThrow("Map drift must be a finite number between 0 and 1");
	expect(() => validateDrift(Number.NaN)).toThrow("Map drift must be a finite number between 0 and 1");
	expect(() => validateDrift(Number.POSITIVE_INFINITY)).toThrow("Map drift must be a finite number between 0 and 1");
});

test("settings loading validates drift and normalizes legacy snapshots", () => {
	expect(() => new GameHandlerBuilder().fromSettings({ ...GameSettings, drift: -1 }).build()).toThrow("Map drift must be a finite number between 0 and 1");
	const legacy = { ...GameSettings } as Partial<typeof GameSettings>;
	delete legacy.drift;
	expect(new GameHandlerBuilder().fromSettings(legacy as typeof GameSettings).build().toSettings().drift).toBe(0);
});
