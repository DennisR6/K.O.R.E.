import { expect, test } from "bun:test";
import {
	createItemDocument,
	createInventoryItem,
	createItemPickup,
	validateItemDocument,
	validateInventoryItem,
	validateItemPickup,
} from "../src/item/types.ts";

test("item document validation accepts a valid full item document", () => {
	const item = createItemDocument({
		id: "anker",
		name: "Anker",
		type: "defensive",
		effects: [{ type: "modifyForce", value: { factor: 0.5 } }],
		targetType: "self",
		duration: { type: "turns", value: 3 },
		useLimit: { perTurn: 1, perGame: 3 },
		targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false },
		cooldown: 1,
	});
	expect(() => validateItemDocument(item)).not.toThrow();
});

test("item document validation rejects missing or invalid fields", () => {
	expect(() => validateItemDocument(null)).toThrow("non-null object");
	expect(() => validateItemDocument({})).toThrow("schema version");
	expect(() => validateItemDocument({ schemaVersion: 1 })).toThrow("non-empty string id");
	expect(() => validateItemDocument({ schemaVersion: 1, id: "test" })).toThrow("non-empty string name");
	expect(() => validateItemDocument({ schemaVersion: 1, id: "test", name: "Test" })).toThrow("string type");
	expect(() => validateItemDocument({ schemaVersion: 1, id: "test", name: "Test", type: "utility" })).toThrow("effects array");
	expect(() => validateItemDocument({ schemaVersion: 1, id: "test", name: "Test", type: "utility", effects: [] })).toThrow("valid target type");
	expect(() => validateItemDocument({ schemaVersion: 1, id: "test", name: "Test", type: "utility", effects: [], targetType: "invalid" })).toThrow("valid target type");
	expect(() => validateItemDocument({ schemaVersion: 1, id: "test", name: "Test", type: "utility", effects: [], targetType: "self" })).toThrow("duration object");
	expect(() => validateItemDocument({ schemaVersion: 1, id: "test", name: "Test", type: "utility", effects: [], targetType: "self", duration: { type: "invalid", value: 0 } })).toThrow("duration must have a valid type");
	expect(() => validateItemDocument({ schemaVersion: 1, id: "test", name: "Test", type: "utility", effects: [], targetType: "self", duration: { type: "instant", value: -1 } })).toThrow("duration value must be a non-negative");
	expect(() => validateItemDocument({ schemaVersion: 1, id: "test", name: "Test", type: "utility", effects: [], targetType: "self", duration: { type: "instant", value: 0 } })).toThrow("useLimit object");
	expect(() => validateItemDocument({ schemaVersion: 1, id: "test", name: "Test", type: "utility", effects: [], targetType: "self", duration: { type: "instant", value: 0 }, useLimit: { perTurn: -1, perGame: 1 } })).toThrow("perTurn must be a non-negative integer");
	expect(() => validateItemDocument({ schemaVersion: 1, id: "test", name: "Test", type: "utility", effects: [], targetType: "self", duration: { type: "instant", value: 0 }, useLimit: { perTurn: 1, perGame: 1 } })).not.toThrow();
});

test("item document validation rejects malformed effects", () => {
	expect(() => validateItemDocument({
		schemaVersion: 1, id: "test", name: "Test", type: "utility",
		effects: [null],
		targetType: "self", duration: { type: "instant", value: 0 },
		useLimit: { perTurn: 1, perGame: 1 },
	})).toThrow("non-null object");
	expect(() => validateItemDocument({
		schemaVersion: 1, id: "test", name: "Test", type: "utility",
		effects: [{ type: "" }],
		targetType: "self", duration: { type: "instant", value: 0 },
		useLimit: { perTurn: 1, perGame: 1 },
	})).toThrow("non-empty string type");
});

test("item document validation rejects invalid targetValidation", () => {
	const base = () => ({
		schemaVersion: 1, id: "test", name: "Test", type: "utility",
		effects: [{ type: "modifyForce" }],
		targetType: "entity", duration: { type: "instant", value: 0 },
		useLimit: { perTurn: 1, perGame: 1 },
	});
	expect(() => validateItemDocument({ ...base(), targetValidation: "invalid" })).toThrow("targetValidation must be an object");
	expect(() => validateItemDocument({ ...base(), targetValidation: { allowSelf: "yes", allowAlly: false, allowEnemy: false } })).toThrow("boolean allowSelf");
	expect(() => validateItemDocument({ ...base(), targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false, maxRange: -1 } })).toThrow("maxRange must be a non-negative");
	expect(() => validateItemDocument({ ...base(), targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false } })).not.toThrow();
});

test("item document validation rejects invalid cooldown", () => {
	const base = () => ({
		schemaVersion: 1, id: "test", name: "Test", type: "utility",
		effects: [{ type: "modifyForce" }],
		targetType: "self", duration: { type: "instant", value: 0 },
		useLimit: { perTurn: 1, perGame: 1 },
	});
	expect(() => validateItemDocument({ ...base(), cooldown: -1 })).toThrow("cooldown must be a non-negative integer");
	expect(() => validateItemDocument({ ...base(), cooldown: 1.5 })).toThrow("cooldown must be a non-negative integer");
	expect(() => validateItemDocument({ ...base(), cooldown: 0 })).not.toThrow();
});

test("inventory item validation accepts valid entries", () => {
	const item = createInventoryItem({ itemId: "anker", remainingUses: 3, usesThisTurn: 0 });
	expect(() => validateInventoryItem(item)).not.toThrow();
});

test("inventory item validation rejects malformed entries", () => {
	expect(() => validateInventoryItem(null)).toThrow("non-null object");
	expect(() => validateInventoryItem({})).toThrow("non-empty string itemId");
	expect(() => validateInventoryItem({ itemId: "test" })).toThrow("remainingUses must be a non-negative integer");
	expect(() => validateInventoryItem({ itemId: "test", remainingUses: -1, usesThisTurn: 0 })).toThrow("remainingUses must be a non-negative integer");
	expect(() => validateInventoryItem({ itemId: "test", remainingUses: 1, usesThisTurn: -1 })).toThrow("usesThisTurn must be a non-negative integer");
});

test("item pickup validation accepts valid entries", () => {
	const pickup = createItemPickup({
		itemId: "anker",
		spawnRegion: { x: 10, y: 20, w: 100, h: 200 },
		activationType: "collision",
		maxPickupsPerTurn: 2,
	});
	expect(() => validateItemPickup(pickup)).not.toThrow();
});

test("item pickup validation rejects malformed entries", () => {
	expect(() => validateItemPickup(null)).toThrow("non-null object");
	expect(() => validateItemPickup({})).toThrow("non-empty string itemId");
	expect(() => validateItemPickup({ itemId: "test" })).toThrow("spawnRegion object");
	expect(() => validateItemPickup({ itemId: "test", spawnRegion: { x: 0, y: 0, w: 0, h: 100 } })).toThrow("w and h must be positive");
	expect(() => validateItemPickup({ itemId: "test", spawnRegion: { x: 0, y: 0, w: 100, h: 100 }, activationType: "invalid" })).toThrow("valid activation type");
	expect(() => validateItemPickup({ itemId: "test", spawnRegion: { x: 0, y: 0, w: 100, h: 100 }, activationType: "collision", maxPickupsPerTurn: -1 })).toThrow("maxPickupsPerTurn must be a non-negative integer");
});

test("createItemDocument returns valid defaults with overrides", () => {
	const doc = createItemDocument({ id: "custom", name: "Custom" });
	expect(doc.id).toBe("custom");
	expect(doc.name).toBe("Custom");
	expect(doc.type).toBe("utility");
	expect(doc.effects).toEqual([]);
	expect(doc.targetType).toBe("self");
	expect(doc.duration).toEqual({ type: "instant", value: 0 });
	expect(doc.useLimit).toEqual({ perTurn: 1, perGame: 1 });
	expect(doc.schemaVersion).toBe(1);
});

test("createInventoryItem returns valid defaults with overrides", () => {
	const inv = createInventoryItem({ itemId: "anker", remainingUses: 5 });
	expect(inv.itemId).toBe("anker");
	expect(inv.remainingUses).toBe(5);
	expect(inv.usesThisTurn).toBe(0);
});

test("createItemPickup returns valid defaults with overrides", () => {
	const pickup = createItemPickup({ itemId: "magnet", activationType: "proximity" });
	expect(pickup.itemId).toBe("magnet");
	expect(pickup.activationType).toBe("proximity");
	expect(pickup.spawnRegion).toEqual({ x: 0, y: 0, w: 100, h: 100 });
});

test("item pickup respawn configuration requires a positive round interval", () => {
	const pickup = createItemPickup({ respawnConfig: { intervalRounds: 2 } });
	expect(() => validateItemPickup(pickup)).not.toThrow();
	expect(() => validateItemPickup({ ...pickup, respawnConfig: { intervalRounds: 0 } })).toThrow("positive integer");
	expect(() => validateItemPickup({ ...pickup, respawnerCountdown: -1 })).toThrow("non-negative integer");
});
