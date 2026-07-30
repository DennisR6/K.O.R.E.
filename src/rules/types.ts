import { validateItemPickup, type ItemPickup } from "../item/types.js";

/** Serializable phases that a game mode may include in its turn loop. */
export const enum RulePhase {
	Item = "item",
	Aim = "aim",
	Charge = "charge",
	Push = "push",
	Physics = "physics",
	Complete = "complete",
}

export const enum WinCondition {
	LastTeamStanding = "last-team-standing",
}

/** A fixed item allocation for one team at match initialization. */
export interface FixedItemLoadout {
	team: number;
	items: { itemId: string; uses: number }[];
}

/** Deterministic draws from the declared item pool. */
export interface SeededItemDrawSettings {
	seed: number;
	itemIds: string[];
	drawsPerTurn: number;
}

/** Declarative item sources available to one game mode. */
export interface ItemEconomySettings {
	fixedLoadouts: FixedItemLoadout[];
	mapPickups: ItemPickup[];
	randomDraw?: SeededItemDrawSettings;
}

export const DEFAULT_ITEM_ECONOMY: ItemEconomySettings = {
	fixedLoadouts: [],
	mapPickups: [],
};

/** Rejects ambiguous or non-deterministic item-economy configuration. */
export function validateItemEconomySettings(settings: unknown): asserts settings is ItemEconomySettings {
	if (!isRecord(settings) || !Array.isArray(settings.fixedLoadouts) || !Array.isArray(settings.mapPickups)) {
		throw new Error("Item economy requires fixed loadouts and map pickups arrays");
	}
	const teams = new Set<number>();
	for (const loadout of settings.fixedLoadouts) {
		if (!isRecord(loadout)) throw new Error("Item loadouts require a non-negative team and items array");
		const team = loadout.team;
		const items = loadout.items;
		if (typeof team !== "number" || !Number.isSafeInteger(team) || team < 0 || !Array.isArray(items)) {
			throw new Error("Item loadouts require a non-negative team and items array");
		}
		if (teams.has(team)) throw new Error("Item economy allows only one loadout per team");
		teams.add(team);
		for (const item of items) {
			if (!isRecord(item)) throw new Error("Fixed loadout items require an id and positive use count");
			const itemId = item.itemId;
			const uses = item.uses;
			if (typeof itemId !== "string" || !itemId || typeof uses !== "number" || !Number.isSafeInteger(uses) || uses < 1) {
				throw new Error("Fixed loadout items require an id and positive use count");
			}
		}
	}
	for (const pickup of settings.mapPickups) validateItemPickup(pickup);
	if (settings.randomDraw !== undefined) {
		const draw = settings.randomDraw;
		if (!isRecord(draw)) throw new Error("Seeded item draws require a safe seed, non-empty item pool, and positive draws per turn");
		const seed = draw.seed;
		const itemIds = draw.itemIds;
		const drawsPerTurn = draw.drawsPerTurn;
		if (typeof seed !== "number" || !Number.isSafeInteger(seed) || !Array.isArray(itemIds) || itemIds.length === 0 || !itemIds.every(itemId => typeof itemId === "string" && itemId) || typeof drawsPerTurn !== "number" || !Number.isSafeInteger(drawsPerTurn) || drawsPerTurn < 1) {
			throw new Error("Seeded item draws require a safe seed, non-empty item pool, and positive draws per turn");
		}
	}
}

/** Data-defined gameplay rules, independent from the simulation handler. */
export interface GameModeSettings {
	id: string;
	phases: RulePhase[];
	maxItemsPerTurn: number;
	winCondition: WinCondition;
	itemEconomy: ItemEconomySettings;
}

/** Serializable progress through a game mode's current turn. */
export interface RuleState {
	phase: RulePhase;
	activeTeam: number;
	turnNumber: number;
	itemUses: number;
}

export const enum MatchEndReason {
	LastTeamStanding = "last-team-standing",
	Draw = "draw",
}

/** Serializable terminal outcome evaluated by game rules. */
export interface MatchResult {
	winnerTeam: number | null;
	reason: MatchEndReason;
	turnNumber: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
