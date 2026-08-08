import { createItemDocument, type ItemDocument } from "./types.js";
import { ItemValidator } from "./validate.js";

function clone<T>(value: T): T { return structuredClone(value); }

export interface KoreItemInput {
	id: string;
	name: string;
	type: string;
	effects?: Array<{ type: string; value?: Record<string, unknown> }>;
	targetType?: ItemDocument["targetType"];
	duration?: ItemDocument["duration"];
	useLimit?: ItemDocument["useLimit"];
	targetValidation?: ItemDocument["targetValidation"];
	description?: string;
	cooldown?: number;
	interaction?: ItemDocument["interaction"];
}

export function sdkItemEffectTypes(): readonly string[] {
	return ["modifyForce", "modifyRotation", "lockRotation", "applyTorque", "spawnTrigger", "delayedEffect", "shield", "swapPosition", "ghostMode", "magnet", "selectionLock", "aimVariance", "temporalModifier", "structureLifecycle"];
}

/** Creates a validated declarative item document without constructing runtime effects. */
export function createItem(input: KoreItemInput): ItemDocument {
	const item = createItemDocument({
		...input,
		effects: (input.effects ?? []).map(effect => ({ type: effect.type, ...(effect.value === undefined ? {} : { value: clone(effect.value) }) })),
	});
	const validator = new ItemValidator();
	for (const effectType of sdkItemEffectTypes()) validator.registerEffectType(effectType);
	for (const effect of item.effects) if (!sdkItemEffectTypes().includes(effect.type)) throw new Error(`Unsupported KORE item effect '${effect.type}'`);
	return clone(validator.validate(item));
}

/** Composes multiple declarative item effects while keeping their order stable. */
export function composeItemEffects(...effects: Array<{ type: string; value?: Record<string, unknown> }>): Array<{ type: string; value?: Record<string, unknown> }> {
	return effects.map(effect => {
		if (!sdkItemEffectTypes().includes(effect.type)) throw new Error(`Unsupported KORE item effect '${effect.type}'`);
		return { type: effect.type, ...(effect.value === undefined ? {} : { value: clone(effect.value) }) };
	});
}
