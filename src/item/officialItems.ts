import { EffectModifyForce } from "../effects/modifyForce.js";
import { EffectMagnet } from "../effects/magnet.js";
import type { ForceInput } from "../effects/types.js";
import { ItemLoader } from "./loader.js";
import { ItemValidator } from "./validate.js";
import type { ItemDocument } from "./types.js";

export const ANKER_FORCE_FACTOR = 0.5;
export const GHOST_MODE_DURATION_TURNS = 2;
export const MAGNET_RANGE = 200;
export const MAGNET_FORCE = 2;

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

export const durchlaessigkeitItem: ItemDocument = {
	schemaVersion: 1,
	id: "durchlaessigkeit",
	name: "Durchlässigkeit",
	description: "Ignores entity and structure collisions for a short duration.",
	type: "defensive",
	effects: [{ type: "ghostMode", value: { durationTurns: GHOST_MODE_DURATION_TURNS } }],
	targetType: "self",
	duration: { type: "turns", value: GHOST_MODE_DURATION_TURNS },
	useLimit: { perTurn: 1, perGame: 1 },
	targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false },
};

export const magnetItem: ItemDocument = {
	schemaVersion: 1,
	id: "magnet",
	name: "Magnet",
	description: "Attracts a targeted figure within a configured range.",
	type: "offensive",
	effects: [{ type: "magnet", value: { mode: "attract", force: MAGNET_FORCE, range: MAGNET_RANGE } }],
	targetType: "entity",
	duration: { type: "turns", value: 1 },
	useLimit: { perTurn: 1, perGame: 2 },
	targetValidation: { allowSelf: false, allowAlly: true, allowEnemy: true, maxRange: MAGNET_RANGE },
};

/** Creates the validated built-in catalog used by the official item pipeline. */
export function createOfficialItemLoader(): ItemLoader {
	const validator = new ItemValidator();
	validator.registerEffectType("modifyForce");
	validator.registerEffectType("ghostMode");
	validator.registerEffectType("magnet");
	const loader = new ItemLoader(validator);
	loader.registerBuiltIn(ankerItem);
	loader.registerBuiltIn(durchlaessigkeitItem);
	loader.registerBuiltIn(magnetItem);
	return loader;
}

/** Applies Anker's deterministic force reduction to one force value. */
export function applyAnkerForce(force: ForceInput): ForceInput {
	return new EffectModifyForce({ typeValue: { factor: ANKER_FORCE_FACTOR } }).applyToForce(force);
}

export function applyMagnetForce(velocity: { x: number; y: number }, source: { x: number; y: number }, target: { x: number; y: number }): { x: number; y: number } {
	return new EffectMagnet({ typeValue: { mode: "attract", force: MAGNET_FORCE, range: MAGNET_RANGE } }).applyToVelocity(velocity, source, target);
}
