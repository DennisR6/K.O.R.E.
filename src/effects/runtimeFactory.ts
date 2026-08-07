import { MetaEffect } from "./effects.js";
import type { Effect, EffectSettings, FullEffectSettings } from "./types.js";

/**
 * Authoritative KORE runtime effect factory.
 * Production code must construct runtime effect instances through this boundary.
 */
export function createRuntimeEffect(settings: EffectSettings | FullEffectSettings): Effect {
	// Trigger composition belongs to the settings/content boundary. Runtime
	// Effects receive only their independent `{ type, typeValue }` contract.
	return new MetaEffect({ type: settings.type, typeValue: settings.typeValue } as EffectSettings);
}
