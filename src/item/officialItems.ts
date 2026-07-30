import { EffectModifyForce } from "../effects/modifyForce.js";
import { EffectMagnet } from "../effects/magnet.js";
import { EffectSpawnTrigger } from "../effects/spawnTrigger.js";
import { EffectDelayed } from "../effects/delayedEffect.js";
import { EffectTemporaryWall } from "../effects/temporaryWall.js";
import { EffectFreeze } from "../effects/freeze.js";
import type { ForceInput } from "../effects/types.js";
import { ItemLoader } from "./loader.js";
import { ItemValidator } from "./validate.js";
import type { ItemDocument } from "./types.js";

export const ANKER_FORCE_FACTOR = 0.5;
export const GHOST_MODE_DURATION_TURNS = 2;
export const MAGNET_RANGE = 200;
export const MAGNET_FORCE = 2;
export const FALLTUER_RADIUS = 25;
export const POWER_DASH_FACTOR = 1.5;
export const DELAYED_MINE_DELAY_TICKS = 3;
export const DELAYED_MINE_RADIUS = 60;
export const DELAYED_MINE_FORCE = 4;
export const MINI_WALL_WIDTH = 80;
export const MINI_WALL_HEIGHT = 10;
export const MINI_WALL_DURATION_TURNS = 3;
export const FREEZE_SHOT_SPEED_FACTOR = 0.25;
export const FREEZE_SHOT_DURATION_TURNS = 2;

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

export const falltuerItem: ItemDocument = {
	schemaVersion: 1,
	id: "falltuer",
	name: "Falltür",
	description: "Spawns a kill zone at a selected position.",
	type: "trap",
	effects: [{ type: "spawnTrigger", value: { triggerId: "falltuer-kill-zone", delayTurns: 0, radius: FALLTUER_RADIUS } }],
	targetType: "position",
	duration: { type: "turns", value: 1 },
	useLimit: { perTurn: 1, perGame: 1 },
	targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true, maxRange: 300 },
};

export const powerDashItem: ItemDocument = {
	schemaVersion: 1,
	id: "power-dash",
	name: "Power-Dash",
	description: "Boosts the next applied force by a configured multiplier.",
	type: "offensive",
	effects: [{ type: "modifyForce", value: { factor: POWER_DASH_FACTOR } }],
	targetType: "self",
	duration: { type: "instant", value: 0 },
	useLimit: { perTurn: 1, perGame: 2 },
	targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false },
};

export const verzoegerteMineItem: ItemDocument = {
	schemaVersion: 1,
	id: "verzoegerte-mine",
	name: "Verzögerte Mine",
	description: "Creates a delayed repelling force explosion at a selected position.",
	type: "trap",
	effects: [{ type: "delayedEffect", value: { effectType: "magnet", effectValue: { mode: "repel", force: DELAYED_MINE_FORCE, range: DELAYED_MINE_RADIUS }, delayTicks: DELAYED_MINE_DELAY_TICKS } }],
	targetType: "position",
	duration: { type: "turns", value: 1 },
	useLimit: { perTurn: 1, perGame: 1 },
	targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true, maxRange: 300 },
};

export const miniWallItem: ItemDocument = {
	schemaVersion: 1,
	id: "mini-wall",
	name: "Mini-Wall",
	description: "Spawns a temporary portable wall at a selected position.",
	type: "defensive",
	effects: [{ type: "temporaryWall", value: { wallId: "mini-wall", x: 0, y: 0, w: MINI_WALL_WIDTH, h: MINI_WALL_HEIGHT, durationTurns: MINI_WALL_DURATION_TURNS } }],
	targetType: "position",
	duration: { type: "turns", value: MINI_WALL_DURATION_TURNS },
	useLimit: { perTurn: 1, perGame: 1 },
	targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true, maxRange: 300 },
};

export const freezeShotItem: ItemDocument = {
	schemaVersion: 1,
	id: "freeze-shot",
	name: "Freeze-Shot",
	description: "Temporarily slows a targeted figure.",
	type: "offensive",
	effects: [{ type: "freeze", value: { speedFactor: FREEZE_SHOT_SPEED_FACTOR, durationTurns: FREEZE_SHOT_DURATION_TURNS } }],
	targetType: "entity",
	duration: { type: "turns", value: FREEZE_SHOT_DURATION_TURNS },
	useLimit: { perTurn: 1, perGame: 2 },
	targetValidation: { allowSelf: false, allowAlly: false, allowEnemy: true, maxRange: 300 },
};

/** Creates the validated built-in catalog used by the official item pipeline. */
export function createOfficialItemLoader(): ItemLoader {
	const validator = new ItemValidator();
	validator.registerEffectType("modifyForce");
	validator.registerEffectType("ghostMode");
	validator.registerEffectType("magnet");
	validator.registerEffectType("spawnTrigger");
	validator.registerEffectType("delayedEffect");
	validator.registerEffectType("temporaryWall");
	validator.registerEffectType("freeze");
	const loader = new ItemLoader(validator);
	loader.registerBuiltIn(ankerItem);
	loader.registerBuiltIn(durchlaessigkeitItem);
	loader.registerBuiltIn(magnetItem);
	loader.registerBuiltIn(falltuerItem);
	loader.registerBuiltIn(powerDashItem);
	loader.registerBuiltIn(verzoegerteMineItem);
	loader.registerBuiltIn(miniWallItem);
	loader.registerBuiltIn(freezeShotItem);
	return loader;
}

/** Applies Anker's deterministic force reduction to one force value. */
export function applyAnkerForce(force: ForceInput): ForceInput {
	return new EffectModifyForce({ typeValue: { factor: ANKER_FORCE_FACTOR } }).applyToForce(force);
}

export function applyPowerDashForce(force: ForceInput): ForceInput {
	return new EffectModifyForce({ typeValue: { factor: POWER_DASH_FACTOR } }).applyToForce(force);
}

export interface VerzoegerteMine {
	center: { x: number; y: number };
	radius: number;
	trigger: EffectDelayed;
	force: EffectMagnet;
}

export function createVerzoegerteMine(center: { x: number; y: number }, delayTicks: number = DELAYED_MINE_DELAY_TICKS): VerzoegerteMine {
	if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) throw new Error("Verzögerte Mine position must be finite");
	const trigger = new EffectDelayed({ typeValue: { effectType: "magnet", effectValue: { mode: "repel", force: DELAYED_MINE_FORCE, range: DELAYED_MINE_RADIUS }, delayTicks } });
	return { center: { ...center }, radius: DELAYED_MINE_RADIUS, trigger, force: new EffectMagnet({ typeValue: { mode: "repel", force: DELAYED_MINE_FORCE, range: DELAYED_MINE_RADIUS } }) };
}

export function applyVerzoegerteMineExplosion(mine: VerzoegerteMine, velocity: { x: number; y: number }, target: { x: number; y: number }): { x: number; y: number } {
	if (!mine.trigger.hasFired()) return { ...velocity };
	return mine.force.applyToVelocity(velocity, mine.center, target);
}

export function createMiniWall(position: { x: number; y: number }, wallId: string = "mini-wall"): EffectTemporaryWall {
	return new EffectTemporaryWall({ typeValue: { wallId, x: position.x, y: position.y, w: MINI_WALL_WIDTH, h: MINI_WALL_HEIGHT, durationTurns: MINI_WALL_DURATION_TURNS } });
}

export function createFreezeShot(): EffectFreeze {
	return new EffectFreeze({ typeValue: { speedFactor: FREEZE_SHOT_SPEED_FACTOR, durationTurns: FREEZE_SHOT_DURATION_TURNS } });
}

export function applyMagnetForce(velocity: { x: number; y: number }, source: { x: number; y: number }, target: { x: number; y: number }): { x: number; y: number } {
	return new EffectMagnet({ typeValue: { mode: "attract", force: MAGNET_FORCE, range: MAGNET_RANGE } }).applyToVelocity(velocity, source, target);
}

export interface FalltuerKillZone {
	triggerId: string;
	center: { x: number; y: number };
	radius: number;
	trigger: EffectSpawnTrigger;
}

export function createFalltuerKillZone(center: { x: number; y: number }, radius: number = FALLTUER_RADIUS): FalltuerKillZone {
	if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) throw new Error("Falltür position must be finite");
	if (!Number.isFinite(radius) || radius <= 0) throw new Error("Falltür radius must be positive");
	return { triggerId: "falltuer-kill-zone", center: { ...center }, radius, trigger: new EffectSpawnTrigger({ typeValue: { triggerId: "falltuer-kill-zone", delayTurns: 0 } }) };
}

export function isInsideFalltuerKillZone(position: { x: number; y: number }, zone: FalltuerKillZone): boolean {
	return Math.hypot(position.x - zone.center.x, position.y - zone.center.y) <= zone.radius;
}
