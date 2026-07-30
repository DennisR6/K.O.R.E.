import { EffectModifyForce } from "../effects/modifyForce.js";
import type { ForceInput } from "../effects/types.js";
import { ItemLoader } from "./loader.js";
import { ItemValidator } from "./validate.js";
import type { ItemDocument } from "./types.js";

export const ANKER_FORCE_FACTOR = 0.5;

/** Declarative built-in Anker item: halves the affected force. */
export const ankerItem: ItemDocument = {
	schemaVersion: 1,
	id: "anker",
	name: "Anker",
	description: "Reduces knockback force for a short duration.",
	type: "defensive",
	effects: [{ type: "modifyForce", value: { factor: ANKER_FORCE_FACTOR } }],
	targetType: "self",
	duration: { type: "turns", value: 2 },
	useLimit: { perTurn: 1, perGame: 2 },
	targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false },
};

/** Creates the validated built-in catalog used by the official item pipeline. */
export function createOfficialItemLoader(): ItemLoader {
	const validator = new ItemValidator();
	validator.registerEffectType("modifyForce");
	const loader = new ItemLoader(validator);
	loader.registerBuiltIn(ankerItem);
	return loader;
}

/** Applies Anker's deterministic force reduction to one force value. */
export function applyAnkerForce(force: ForceInput): ForceInput {
	return new EffectModifyForce({ typeValue: { factor: ANKER_FORCE_FACTOR } }).applyToForce(force);
}
