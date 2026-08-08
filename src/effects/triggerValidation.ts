import { EffectTrigger, type TriggerSettings } from "./types.js";

const TRIGGER_KEYS = new Set(["trigger", "triggerValue"]);

/** Validates Trigger data without inspecting or depending on an Effect. */
export function validateTriggerSettings(value: unknown): asserts value is TriggerSettings {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Trigger settings must be an object");
	const trigger = value as Record<string, unknown>;
	for (const key of Object.keys(trigger)) if (!TRIGGER_KEYS.has(key)) throw new Error(`Trigger settings contain unknown field '${key}'`);
	if (trigger.trigger !== EffectTrigger.Always && trigger.trigger !== EffectTrigger.Collision && trigger.trigger !== EffectTrigger.Round) throw new Error(`Unknown effect trigger '${String(trigger.trigger)}'`);
	if (!Array.isArray(trigger.triggerValue) || trigger.triggerValue.length !== 0) throw new Error(`Trigger '${String(trigger.trigger)}' requires an empty payload`);
}
