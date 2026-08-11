import type { UiComponentSettings } from "@coffeemakerstudio/drip";

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

export type ItemInteractionMode = "stack" | "replace" | "reject";

/** Declarative composition policy for effects already installed on a target. */
export interface ItemInteractionPolicy {
	mode: ItemInteractionMode;
	/** Per-item overrides; the other item's policy may define the reverse pair. */
	with?: Record<string, ItemInteractionMode>;
	/** Lower orders are applied first when effects are composed. */
	order?: number;
}

export interface ItemUiSettings {
	component?: UiComponentSettings;
	showLabel?: boolean;
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
	interaction?: ItemInteractionPolicy;
	ui?: ItemUiSettings;
}

export interface InventoryItem {
	itemId: string;
	remainingUses: number;
	usesThisTurn: number;
}

export interface RespawnConfig {
	intervalRounds: number;
	relocate?: boolean;
}

export interface ItemPickup {
	itemId: string;
	spawnRegion: { x: number; y: number; w: number; h: number };
	activationType: ActivationType;
	maxPickupsPerTurn?: number;
	respawnerCountdown?: number;
	respawnConfig?: RespawnConfig;
}

/** Serializable progress for configured map pickups in the current turn. */
export interface ItemPickupState {
	turnNumber: number;
	pickups: { collected: number; occupants: string[]; respawnCountdown?: number; spawnRegion?: { x: number; y: number; w: number; h: number } }[];
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
		interaction: overrides.interaction ?? { mode: "stack", order: 0 },
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
const VALID_INTERACTION_MODES: string[] = ["stack", "replace", "reject"];

export function validateItemDocument(document: unknown): asserts document is ItemDocument {
	if (typeof document !== "object" || document === null) throw new Error("Item document must be a non-null object");
	const doc = document as Record<string, unknown>;
	if (doc.schemaVersion !== 1) throw new Error("Item document must have schema version 1");
	if (typeof doc.id !== "string" || !doc.id) throw new Error("Item document must have a non-empty string id");
	if (typeof doc.name !== "string" || !doc.name) throw new Error("Item document must have a non-empty string name");
	if (typeof doc.type !== "string") throw new Error("Item document must have a string type");
	if (doc.ui !== undefined) {
		if (typeof doc.ui !== "object" || doc.ui === null || Array.isArray(doc.ui)) throw new Error("Item ui must be an object");
		const ui = doc.ui as Record<string, unknown>;
		if (Object.keys(ui).some(key => key !== "component" && key !== "showLabel")) throw new Error("Item ui contains an unknown field");
		if (ui.component !== undefined) {
			const component = ui.component as Record<string, unknown>;
			if (component.type !== "image" || typeof component.source !== "string" || component.source.length === 0 || Object.keys(component).some(key => key !== "type" && key !== "source")) throw new Error("Item ui component must be a non-empty image source");
		}
		if (ui.showLabel !== undefined && typeof ui.showLabel !== "boolean") throw new Error("Item ui showLabel must be a boolean");
	}
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
	if (doc.interaction !== undefined) {
		if (typeof doc.interaction !== "object" || doc.interaction === null) throw new Error("Item interaction must be an object");
		const interaction = doc.interaction as Record<string, unknown>;
		if (!VALID_INTERACTION_MODES.includes(interaction.mode as string)) throw new Error("Item interaction must have a valid mode");
		if (interaction.order !== undefined && (!Number.isSafeInteger(interaction.order) || (interaction.order as number) < 0)) throw new Error("Item interaction order must be a non-negative integer");
		if (interaction.with !== undefined) {
			if (typeof interaction.with !== "object" || interaction.with === null || Array.isArray(interaction.with)) throw new Error("Item interaction overrides must be an object");
			for (const [itemId, mode] of Object.entries(interaction.with as Record<string, unknown>)) {
				if (!itemId || !VALID_INTERACTION_MODES.includes(mode as string)) throw new Error("Item interaction overrides must contain valid item IDs and modes");
			}
		}
	}
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
	if (typeof region.x !== "number" || !Number.isFinite(region.x) || typeof region.y !== "number" || !Number.isFinite(region.y) || typeof region.w !== "number" || !Number.isFinite(region.w) || typeof region.h !== "number" || !Number.isFinite(region.h)) throw new Error("Item pickup spawnRegion must have finite numeric x, y, w, h");
	if (region.w <= 0 || region.h <= 0) throw new Error("Item pickup spawnRegion w and h must be positive");
	if (!VALID_ACTIVATION_TYPES.includes(p.activationType as string)) throw new Error("Item pickup must have a valid activation type");
	if (p.maxPickupsPerTurn !== undefined && (typeof p.maxPickupsPerTurn !== "number" || !Number.isSafeInteger(p.maxPickupsPerTurn) || p.maxPickupsPerTurn < 0)) throw new Error("Item pickup maxPickupsPerTurn must be a non-negative integer");
	if (p.respawnerCountdown !== undefined && (typeof p.respawnerCountdown !== "number" || !Number.isSafeInteger(p.respawnerCountdown) || p.respawnerCountdown < 0)) throw new Error("Item pickup respawnerCountdown must be a non-negative integer");
	if (p.respawnConfig !== undefined) {
		if (typeof p.respawnConfig !== "object" || p.respawnConfig === null) throw new Error("Item pickup respawnConfig must be an object");
		const config = p.respawnConfig as Record<string, unknown>;
		if (typeof config.intervalRounds !== "number" || !Number.isSafeInteger(config.intervalRounds) || config.intervalRounds < 1) throw new Error("Item pickup respawnConfig intervalRounds must be a positive integer");
		if (config.relocate !== undefined && typeof config.relocate !== "boolean") throw new Error("Item pickup respawnConfig relocate must be boolean");
	}
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
		if (entry.respawnCountdown !== undefined && (typeof entry.respawnCountdown !== "number" || !Number.isSafeInteger(entry.respawnCountdown) || entry.respawnCountdown < 0)) throw new Error("Item pickup state must have a non-negative respawn countdown");
		if (entry.spawnRegion !== undefined) validatePickupRegion(entry.spawnRegion);
	}
}

function validatePickupRegion(value: unknown): void {
	if (typeof value !== "object" || value === null) throw new Error("Item pickup state spawn region must be an object");
	const region = value as Record<string, unknown>;
	if (!["x", "y", "w", "h"].every(key => typeof region[key] === "number" && Number.isFinite(region[key]))) throw new Error("Item pickup state spawn region must have finite numeric bounds");
	if ((region.w as number) <= 0 || (region.h as number) <= 0) throw new Error("Item pickup state spawn region dimensions must be positive");
}
