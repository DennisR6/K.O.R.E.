import { expect, test } from "bun:test";
import { EffectTrigger, EffectType, ItemEffectType, SettingOperation } from "../src/effects/types.ts";
import { validateEffectSettings, validateFullEffectSettings, validateRuntimeItemEffectSettings } from "../src/effects/validate.ts";

test("core Effect validation is independent from trigger composition", () => {
	const effect = { schemaVersion: 1, type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "drawingEnabled", value: false } };
	expect(() => validateEffectSettings(effect)).not.toThrow();
	expect(() => validateFullEffectSettings({ ...effect, trigger: EffectTrigger.Collision, triggerValue: [] })).not.toThrow();
});

test("core Effect validation rejects malformed and executable payloads", () => {
	expect(() => validateEffectSettings({ schemaVersion: 1, type: EffectType.Movement, typeValue: { deltaTime: 1, x: Number.NaN, y: 0 } })).toThrow();
	expect(() => validateEffectSettings({ schemaVersion: 1, type: EffectType.ModifySetting, typeValue: { operation: "add", key: "hp", value: 1, callback: () => undefined } })).toThrow();
	expect(() => validateFullEffectSettings({ schemaVersion: 1, type: EffectType.Velocity, typeValue: { x: 0, y: 0 }, trigger: "unknown", triggerValue: [] })).toThrow();
	expect(() => validateEffectSettings({ type: EffectType.ModifySetting, typeValue: { operation: "add", key: "hp", value: 1 } })).toThrow(/schema version/);
});

test("persistent item Effect validation checks typed lifecycle state", () => {
	expect(() => validateRuntimeItemEffectSettings({ type: ItemEffectType.Freeze, typeValue: { speedFactor: 0.25, durationTurns: 2, remainingTurns: 1 } })).not.toThrow();
	expect(() => validateRuntimeItemEffectSettings({ type: ItemEffectType.Freeze, typeValue: { speedFactor: 2, durationTurns: 2 } })).toThrow();
	expect(() => validateRuntimeItemEffectSettings({ type: ItemEffectType.Shield, typeValue: { capacity: 2, remainingCapacity: 3 } })).toThrow();
});
