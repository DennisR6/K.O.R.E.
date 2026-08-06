import { MetaEffect } from "./effects.js";
import type { Effect, EffectSettings } from "./types.js";

/**
 * Authoritative KORE runtime effect factory.
 * Production code must construct runtime effect instances through this boundary.
 */
export function createRuntimeEffect(settings: EffectSettings): Effect {
	return new MetaEffect(settings);
}
