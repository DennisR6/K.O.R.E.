import { expect, test } from "bun:test";
import { EffectTrigger, EffectType, type EffectSettings, type FullEffectSettings, type TriggerSettings } from "../src/effects/types.ts";
import { validateTriggerSettings } from "../src/effects/triggerValidation.ts";
import { validateFullEffectSettings } from "../src/effects/validate.ts";

test("Trigger settings validate independently from concrete Effects", () => {
	const trigger: TriggerSettings = { trigger: EffectTrigger.Collision, triggerValue: [] };
	expect(() => validateTriggerSettings(trigger)).not.toThrow();
	expect(() => validateTriggerSettings({ trigger: EffectTrigger.Round, triggerValue: ["unexpected"] })).toThrow();
});

test("FullEffectSettings composes independently validated Effect and Trigger data", () => {
	const effect: EffectSettings = { type: EffectType.Damage, typeValue: { damage: 2 } };
	const full: FullEffectSettings = { ...effect, trigger: EffectTrigger.Collision, triggerValue: [] };

	expect(() => validateFullEffectSettings(full)).not.toThrow();
});
