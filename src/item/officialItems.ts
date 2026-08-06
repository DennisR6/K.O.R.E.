import { EffectModifyForce } from "../effects/modifyForce.js";
import { EffectMagnet } from "../effects/magnet.js";
import { EffectSpawnTrigger } from "../effects/spawnTrigger.js";
import { EffectDelayed } from "../effects/delayedEffect.js";
import { EffectTemporaryWall } from "../effects/temporaryWall.js";
import { EffectFreeze } from "../effects/freeze.js";
import { EffectSwapPosition, type PositionTargetState } from "../effects/swapPosition.js";
import { EffectSelectionLock } from "../effects/selectionLock.js";
import { EffectAimVariance } from "../effects/aimVariance.js";
import type { ForceInput } from "../effects/types.js";
import { ItemLoader } from "./loader.js";
import { ItemValidator } from "./validate.js";
import { addDrawnInventoryItem } from "./inventory.js";
import type { InventoryItem, ItemDocument } from "./types.js";
import { createItem } from "../kore/sdk/index.js";

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
export const SWITCH_RANGE = 300;
export const JAEGERMEISTER_ELIXIER_DURATION_TURNS = 2;
export const VODKA_ZERO_MAX_VARIANCE_DEGREES = 10;
export const MYSTERY_BOX_ITEM_ID = "mystery-box";
/** Default reward pool used when a game mode does not configure one. */
export const DEFAULT_MYSTERY_BOX_POOL = ["anker", "durchlaessigkeit", "power-dash", "magnet", "freeze-shot"];

/** Declarative built-in Anker item: halves the affected force. */
export const ankerItem: ItemDocument = createItem({
	id: "anker",
	name: "Anker",
	description: "Reduces knockback force for a short duration.",
	type: "defensive",
	effects: [{ type: "modifyForce", value: { factor: ANKER_FORCE_FACTOR } }],
	targetType: "self",
	duration: { type: "turns", value: 2 },
	useLimit: { perTurn: 1, perGame: 2 },
	targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false },
});

export const durchlaessigkeitItem: ItemDocument = createItem({
	id: "durchlaessigkeit",
	name: "Durchlässigkeit",
	description: "Ignores entity and structure collisions for a short duration.",
	type: "defensive",
	effects: [{ type: "ghostMode", value: { durationTurns: GHOST_MODE_DURATION_TURNS } }],
	targetType: "self",
	duration: { type: "turns", value: GHOST_MODE_DURATION_TURNS },
	useLimit: { perTurn: 1, perGame: 1 },
	targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false },
});

export const magnetItem: ItemDocument = createItem({
	id: "magnet",
	name: "Magnet",
	description: "Attracts a targeted figure within a configured range.",
	type: "offensive",
	effects: [{ type: "magnet", value: { mode: "attract", force: MAGNET_FORCE, range: MAGNET_RANGE } }],
	targetType: "entity",
	duration: { type: "turns", value: 1 },
	useLimit: { perTurn: 1, perGame: 2 },
	targetValidation: { allowSelf: false, allowAlly: true, allowEnemy: true, maxRange: MAGNET_RANGE },
});

export const falltuerItem: ItemDocument = createItem({
	id: "falltuer",
	name: "Falltür",
	description: "Spawns a kill zone at a selected position.",
	type: "trap",
	effects: [{ type: "spawnTrigger", value: { triggerId: "falltuer-kill-zone", delayTurns: 0, radius: FALLTUER_RADIUS } }],
	targetType: "position",
	duration: { type: "turns", value: 1 },
	useLimit: { perTurn: 1, perGame: 1 },
	targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true, maxRange: 300 },
});

export const powerDashItem: ItemDocument = createItem({
	id: "power-dash",
	name: "Power-Dash",
	description: "Boosts the next applied force by a configured multiplier.",
	type: "offensive",
	effects: [{ type: "modifyForce", value: { factor: POWER_DASH_FACTOR } }],
	targetType: "self",
	duration: { type: "instant", value: 0 },
	useLimit: { perTurn: 1, perGame: 2 },
	targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false },
});

export const verzoegerteMineItem: ItemDocument = createItem({
	id: "verzoegerte-mine",
	name: "Verzögerte Mine",
	description: "Creates a delayed repelling force explosion at a selected position.",
	type: "trap",
	effects: [{ type: "delayedEffect", value: { effectType: "magnet", effectValue: { mode: "repel", force: DELAYED_MINE_FORCE, range: DELAYED_MINE_RADIUS }, delayTicks: DELAYED_MINE_DELAY_TICKS } }],
	targetType: "position",
	duration: { type: "turns", value: 1 },
	useLimit: { perTurn: 1, perGame: 1 },
	targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true, maxRange: 300 },
});

export const miniWallItem: ItemDocument = createItem({
	id: "mini-wall",
	name: "Mini-Wall",
	description: "Spawns a temporary portable wall at a selected position.",
	type: "defensive",
	effects: [{ type: "temporaryWall", value: { wallId: "mini-wall", x: 0, y: 0, w: MINI_WALL_WIDTH, h: MINI_WALL_HEIGHT, durationTurns: MINI_WALL_DURATION_TURNS } }],
	targetType: "position",
	duration: { type: "turns", value: MINI_WALL_DURATION_TURNS },
	useLimit: { perTurn: 1, perGame: 1 },
	targetValidation: { allowSelf: true, allowAlly: true, allowEnemy: true, maxRange: 300 },
});

export const freezeShotItem: ItemDocument = createItem({
	id: "freeze-shot",
	name: "Freeze-Shot",
	description: "Temporarily slows a targeted figure.",
	type: "offensive",
	effects: [{ type: "freeze", value: { speedFactor: FREEZE_SHOT_SPEED_FACTOR, durationTurns: FREEZE_SHOT_DURATION_TURNS } }],
	targetType: "entity",
	duration: { type: "turns", value: FREEZE_SHOT_DURATION_TURNS },
	useLimit: { perTurn: 1, perGame: 2 },
	targetValidation: { allowSelf: false, allowAlly: false, allowEnemy: true, maxRange: 300 },
});

export const switchItem: ItemDocument = createItem({
	id: "switch",
	name: "Switch",
	description: "Swaps the active figure's position with a targeted ally.",
	type: "utility",
	effects: [{ type: "swapPosition", value: {} }],
	targetType: "entity",
	duration: { type: "instant", value: 0 },
	useLimit: { perTurn: 1, perGame: 1 },
	targetValidation: { allowSelf: false, allowAlly: true, allowEnemy: false, maxRange: SWITCH_RANGE },
});

export const jaegermeisterElixierItem: ItemDocument = createItem({
	id: "jaegermeister-elixier",
	name: "Jägermeister-Elixier",
	description: "Prevents an opponent figure from being selected for its duration.",
	type: "debuff",
	effects: [{ type: "selectionLock", value: { durationTurns: JAEGERMEISTER_ELIXIER_DURATION_TURNS } }],
	targetType: "entity",
	duration: { type: "turns", value: JAEGERMEISTER_ELIXIER_DURATION_TURNS },
	useLimit: { perTurn: 1, perGame: 1 },
	targetValidation: { allowSelf: false, allowAlly: false, allowEnemy: true, maxRange: 300 },
});

export const vodkaZeroItem: ItemDocument = createItem({
	id: "vodka-zero",
	name: "Vodka-Zero",
	description: "Adds seeded deterministic aim variance to shots.",
	type: "offensive",
	effects: [{ type: "aimVariance", value: { maxVarianceDegrees: VODKA_ZERO_MAX_VARIANCE_DEGREES } }],
	targetType: "self",
	duration: { type: "instant", value: 0 },
	useLimit: { perTurn: 1, perGame: 2 },
	targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false },
});

export const mysteryBoxItem: ItemDocument = createItem({
	id: MYSTERY_BOX_ITEM_ID,
	name: "Wunderkiste",
	description: "Spawns randomly on the map and grants either a specific item or a random item from the pool.",
	type: "utility",
	effects: [{ type: "spawnTrigger", value: { triggerId: "mystery-box-grant", delayTurns: 0 } }],
	targetType: "self",
	duration: { type: "instant", value: 0 },
	useLimit: { perTurn: 1, perGame: 3 },
	targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false },
});

export interface MysteryBoxRewardOptions {
	specificItemId?: string;
	candidatePool?: string[];
	seed?: number;
	/** Allows the reward to resolve to another mystery box. Defaults to false. */
	allowMysteryBoxReward?: boolean;
	/** Declared item registry; reward IDs outside it are rejected. */
	knownItemIds?: readonly string[];
}

function validateMysteryBoxReward(rewardId: string, options: MysteryBoxRewardOptions): void {
	if (rewardId === MYSTERY_BOX_ITEM_ID && !options.allowMysteryBoxReward) {
		throw new Error("Mystery Box rewards must not resolve to another mystery box unless explicitly enabled");
	}
	if (options.knownItemIds && !options.knownItemIds.includes(rewardId)) {
		throw new Error(`Mystery Box reward '${rewardId}' is not a known item`);
	}
}

/** Resolves either a specific item ID or a random item ID from the candidate pool using SDK item definitions. */
export function resolveMysteryBoxReward(options: MysteryBoxRewardOptions = {}): string {
	if (options.specificItemId) {
		validateMysteryBoxReward(options.specificItemId, options);
		return options.specificItemId;
	}
	const pool = options.candidatePool ?? DEFAULT_MYSTERY_BOX_POOL;
	if (pool.length === 0) throw new Error("Mystery Box pool must not be empty");
	// The whole pool is validated, not just the drawn entry: an unknown or
	// recursive entry is rejected even if the current seed never selects it.
	for (const itemId of pool) validateMysteryBoxReward(itemId, options);
	const seed = options.seed !== undefined ? options.seed : Math.floor(Math.random() * 100000);
	const index = Math.abs(seed) % pool.length;
	return pool[index]!;
}

/**
 * Resolves a mystery-box reward and grants exactly one use of it into an
 * inventory, capped by the reward's per-game limit. Returns the reward ID.
 */
export function grantMysteryBoxReward(inventory: InventoryItem[], documents: readonly ItemDocument[], options: MysteryBoxRewardOptions = {}): string {
	const rewardId = resolveMysteryBoxReward({ ...options, knownItemIds: documents.map(document => document.id) });
	const document = documents.find(candidate => candidate.id === rewardId);
	if (!document) throw new Error(`Mystery Box reward '${rewardId}' is not a known item`);
	addDrawnInventoryItem(inventory, document);
	return rewardId;
}

/** Deterministic FNV-1a hash used to seed mystery-box resolution from stable strings. */
export function hashString(value: string): number {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash = Math.imul(hash ^ value.charCodeAt(index), 16777619) >>> 0;
	}
	return hash >>> 0;
}

/**
 * Derives the deterministic reward seed for one mystery-box use from
 * snapshot-stable state, so restore and replay reproduce the same reward.
 */
export function deriveMysteryBoxSeed(options: { actorId: string; turnNumber: number; activeTeam: number; baseSeed: number }): number {
	return (options.baseSeed + hashString(options.actorId) + options.turnNumber * 7 + options.activeTeam * 13) >>> 0;
}

/** Generates a random map pickup region bounds within world bounds for random item spawning. */
export function generateRandomMapPickupPosition(worldSize: { x: number; y: number }, padding: number = 40, seed?: number): { x: number; y: number; w: number; h: number } {
	const minX = padding;
	const maxX = Math.max(minX + 1, worldSize.x - padding - 40);
	const minY = padding;
	const maxY = Math.max(minY + 1, worldSize.y - padding - 40);
	const rng = seed !== undefined ? Math.abs(seed) : Math.floor(Math.random() * 100000);
	const x = minX + (rng % Math.floor(maxX - minX + 1));
	const y = minY + (Math.floor(rng / 7) % Math.floor(maxY - minY + 1));
	return { x, y, w: 40, h: 40 };
}

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
	validator.registerEffectType("swapPosition");
	validator.registerEffectType("selectionLock");
	validator.registerEffectType("aimVariance");
	const loader = new ItemLoader(validator);
	loader.registerBuiltIn(ankerItem);
	loader.registerBuiltIn(durchlaessigkeitItem);
	loader.registerBuiltIn(magnetItem);
	loader.registerBuiltIn(falltuerItem);
	loader.registerBuiltIn(powerDashItem);
	loader.registerBuiltIn(verzoegerteMineItem);
	loader.registerBuiltIn(miniWallItem);
	loader.registerBuiltIn(freezeShotItem);
	loader.registerBuiltIn(switchItem);
	loader.registerBuiltIn(jaegermeisterElixierItem);
	loader.registerBuiltIn(vodkaZeroItem);
	loader.registerBuiltIn(mysteryBoxItem);
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

export function createSelectionLock(): EffectSelectionLock {
	return new EffectSelectionLock({ typeValue: { durationTurns: JAEGERMEISTER_ELIXIER_DURATION_TURNS } });
}

export function createVodkaZero(seed: number = 42): EffectAimVariance {
	return new EffectAimVariance({ typeValue: { maxVarianceDegrees: VODKA_ZERO_MAX_VARIANCE_DEGREES, seed } });
}

export function applySwitch(first: PositionTargetState, second: PositionTargetState): [ { x: number; y: number }, { x: number; y: number } ] {
	return new EffectSwapPosition().swap(first, second);
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
