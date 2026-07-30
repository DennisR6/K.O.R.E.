export type ItemTargetType = "self" | "entity" | "position" | "zone";
export type DurationType = "instant" | "turns" | "rounds";
export type ActivationType = "collision" | "proximity";

export interface FullItemEffect {
	type: string;
	value?: Record<string, unknown>;
}

export interface ItemDuration {
	type: DurationType;
	value: number;
}

export interface ItemUseLimit {
	perTurn: number;
	perGame: number;
}

export interface ItemTargetValidation {
	allowSelf: boolean;
	allowAlly: boolean;
	allowEnemy: boolean;
	maxRange?: number;
}

export interface ItemDocument {
	schemaVersion: number;
	id: string;
	name: string;
	description?: string;
	type: string;
	effects: FullItemEffect[];
	targetType: ItemTargetType;
	duration: ItemDuration;
	useLimit: ItemUseLimit;
	targetValidation?: ItemTargetValidation;
	cooldown?: number;
}

export interface InventoryItem {
	itemId: string;
	remainingUses: number;
	usesThisTurn: number;
}

export interface ItemPickup {
	itemId: string;
	spawnRegion: { x: number; y: number; w: number; h: number };
	activationType: ActivationType;
	maxPickupsPerTurn?: number;
}

/** Serializable progress for configured map pickups in the current turn. */
export interface ItemPickupState {
	turnNumber: number;
	pickups: { collected: number; occupants: string[] }[];
}

export function createItemDocument(overrides: Partial<ItemDocument> = {}): ItemDocument {
	return {
		schemaVersion: 1,
		id: overrides.id ?? "test-item",
		name: overrides.name ?? "Test Item",
		type: overrides.type ?? "utility",
		effects: overrides.effects ?? [],
		targetType: overrides.targetType ?? "self",
		duration: overrides.duration ?? { type: "instant", value: 0 },
		useLimit: overrides.useLimit ?? { perTurn: 1, perGame: 1 },
		...overrides,
	};
}

export function createInventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
	return {
		itemId: overrides.itemId ?? "test-item",
		remainingUses: overrides.remainingUses ?? 1,
		usesThisTurn: overrides.usesThisTurn ?? 0,
	};
}

export function createItemPickup(overrides: Partial<ItemPickup> = {}): ItemPickup {
	return {
		itemId: overrides.itemId ?? "test-item",
		spawnRegion: overrides.spawnRegion ?? { x: 0, y: 0, w: 100, h: 100 },
		activationType: overrides.activationType ?? "collision",
		...overrides,
	};
}

const VALID_DURATION_TYPES: string[] = ["instant", "turns", "rounds"];
const VALID_TARGET_TYPES: string[] = ["self", "entity", "position", "zone"];
const VALID_ACTIVATION_TYPES: string[] = ["collision", "proximity"];

export function validateItemDocument(document: unknown): asserts document is ItemDocument {
	if (typeof document !== "object" || document === null) throw new Error("Item document must be a non-null object");
	const doc = document as Record<string, unknown>;
	if (doc.schemaVersion !== 1) throw new Error("Item document must have schema version 1");
	if (typeof doc.id !== "string" || !doc.id) throw new Error("Item document must have a non-empty string id");
	if (typeof doc.name !== "string" || !doc.name) throw new Error("Item document must have a non-empty string name");
	if (typeof doc.type !== "string") throw new Error("Item document must have a string type");
	if (!Array.isArray(doc.effects)) throw new Error("Item document must have an effects array");
	if (!VALID_TARGET_TYPES.includes(doc.targetType as string)) throw new Error("Item document must have a valid target type");
	if (typeof doc.duration !== "object" || doc.duration === null) throw new Error("Item document must have a duration object");
	const duration = doc.duration as Record<string, unknown>;
	if (!VALID_DURATION_TYPES.includes(duration.type as string)) throw new Error("Item duration must have a valid type");
	if (typeof duration.value !== "number" || !Number.isFinite(duration.value) || duration.value < 0) throw new Error("Item duration value must be a non-negative finite number");
	if (typeof doc.useLimit !== "object" || doc.useLimit === null) throw new Error("Item document must have a useLimit object");
	const useLimit = doc.useLimit as Record<string, unknown>;
	if (typeof useLimit.perTurn !== "number" || !Number.isSafeInteger(useLimit.perTurn) || useLimit.perTurn < 0) throw new Error("Item use-limit perTurn must be a non-negative integer");
	if (typeof useLimit.perGame !== "number" || !Number.isSafeInteger(useLimit.perGame) || useLimit.perGame < 0) throw new Error("Item use-limit perGame must be a non-negative integer");
	for (const effect of doc.effects) {
		if (typeof effect !== "object" || effect === null) throw new Error("Each item effect must be a non-null object");
		const eff = effect as Record<string, unknown>;
		if (typeof eff.type !== "string" || !eff.type) throw new Error("Each item effect must have a non-empty string type");
	}
	if (doc.targetValidation !== undefined && doc.targetValidation !== null) {
		if (typeof doc.targetValidation !== "object") throw new Error("Item targetValidation must be an object");
		const tv = doc.targetValidation as Record<string, unknown>;
		if (typeof tv.allowSelf !== "boolean") throw new Error("Item targetValidation must have a boolean allowSelf");
		if (typeof tv.allowAlly !== "boolean") throw new Error("Item targetValidation must have a boolean allowAlly");
		if (typeof tv.allowEnemy !== "boolean") throw new Error("Item targetValidation must have a boolean allowEnemy");
		if (tv.maxRange !== undefined && (typeof tv.maxRange !== "number" || !Number.isFinite(tv.maxRange) || tv.maxRange < 0)) throw new Error("Item targetValidation maxRange must be a non-negative finite number");
	}
	if (doc.cooldown !== undefined && (typeof doc.cooldown !== "number" || !Number.isSafeInteger(doc.cooldown) || doc.cooldown < 0)) throw new Error("Item cooldown must be a non-negative integer");
}

export function validateInventoryItem(item: unknown): asserts item is InventoryItem {
	if (typeof item !== "object" || item === null) throw new Error("Inventory item must be a non-null object");
	const inv = item as Record<string, unknown>;
	if (typeof inv.itemId !== "string" || !inv.itemId) throw new Error("Inventory item must have a non-empty string itemId");
	if (typeof inv.remainingUses !== "number" || !Number.isSafeInteger(inv.remainingUses) || inv.remainingUses < 0) throw new Error("Inventory item remainingUses must be a non-negative integer");
	if (typeof inv.usesThisTurn !== "number" || !Number.isSafeInteger(inv.usesThisTurn) || inv.usesThisTurn < 0) throw new Error("Inventory item usesThisTurn must be a non-negative integer");
}

export function validateItemPickup(pickup: unknown): asserts pickup is ItemPickup {
	if (typeof pickup !== "object" || pickup === null) throw new Error("Item pickup must be a non-null object");
	const p = pickup as Record<string, unknown>;
	if (typeof p.itemId !== "string" || !p.itemId) throw new Error("Item pickup must have a non-empty string itemId");
	if (typeof p.spawnRegion !== "object" || p.spawnRegion === null) throw new Error("Item pickup must have a spawnRegion object");
	const region = p.spawnRegion as Record<string, unknown>;
	if (typeof region.x !== "number" || typeof region.y !== "number" || typeof region.w !== "number" || typeof region.h !== "number") throw new Error("Item pickup spawnRegion must have numeric x, y, w, h");
	if (region.w <= 0 || region.h <= 0) throw new Error("Item pickup spawnRegion w and h must be positive");
	if (!VALID_ACTIVATION_TYPES.includes(p.activationType as string)) throw new Error("Item pickup must have a valid activation type");
	if (p.maxPickupsPerTurn !== undefined && (typeof p.maxPickupsPerTurn !== "number" || !Number.isSafeInteger(p.maxPickupsPerTurn) || p.maxPickupsPerTurn < 0)) throw new Error("Item pickup maxPickupsPerTurn must be a non-negative integer");
}

export function validateItemPickupState(state: unknown, pickupCount: number): asserts state is ItemPickupState {
	if (typeof state !== "object" || state === null) throw new Error("Item pickup state must be a non-null object");
	const value = state as Record<string, unknown>;
	if (typeof value.turnNumber !== "number" || !Number.isSafeInteger(value.turnNumber) || value.turnNumber < 0) throw new Error("Item pickup state must have a non-negative turn number");
	if (!Array.isArray(value.pickups) || value.pickups.length !== pickupCount) throw new Error("Item pickup state must match configured pickups");
	for (const pickup of value.pickups) {
		if (typeof pickup !== "object" || pickup === null) throw new Error("Item pickup state must contain pickup entries");
		const entry = pickup as Record<string, unknown>;
		if (typeof entry.collected !== "number" || !Number.isSafeInteger(entry.collected) || entry.collected < 0) throw new Error("Item pickup state must have non-negative collection counts");
		if (!Array.isArray(entry.occupants) || !entry.occupants.every(id => typeof id === "string") || new Set(entry.occupants).size !== entry.occupants.length) throw new Error("Item pickup state must have unique occupant IDs");
	}
}
