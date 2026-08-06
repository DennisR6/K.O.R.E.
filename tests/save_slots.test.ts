import { test, expect, describe } from "bun:test";
import { createSaveSlot, validateSaveSlotDocument } from "../src/persistence/saveSlots.js";
import { createDefaultGameSettings } from "../src/settings/settings.js";
import { migrateDocument, DOCUMENT_SCHEMA_VERSION } from "../src/contracts/documents.js";

describe("Save Slots", () => {
	test("creates and validates a correct save slot document", () => {
		const settings = createDefaultGameSettings();
		const snapshot = { state: "GameState.Your_turn", turnNumber: 1, activeTeam: 0 };
		const slot = createSaveSlot("slot-1", "Test Match", settings, snapshot);

		expect(slot.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
		expect(slot.id).toBe("slot-1");
		expect(slot.name).toBe("Test Match");
		expect(slot.snapshot).toEqual(snapshot);

		expect(() => validateSaveSlotDocument(slot)).not.toThrow();
	});

	test("rejects malformed save slot documents", () => {
		const settings = createDefaultGameSettings();
		const snapshot = {};

		const invalidVersion = { schemaVersion: 999, id: "1", name: "Bad", timestamp: Date.now(), settings, snapshot };
		expect(() => validateSaveSlotDocument(invalidVersion)).toThrow();

		const missingName = { schemaVersion: DOCUMENT_SCHEMA_VERSION, id: "1", timestamp: Date.now(), settings, snapshot };
		expect(() => validateSaveSlotDocument(missingName)).toThrow();

		const invalidSettings = { schemaVersion: DOCUMENT_SCHEMA_VERSION, id: "1", name: "Bad Settings", timestamp: Date.now(), settings: { schemaVersion: 99 }, snapshot };
		expect(() => validateSaveSlotDocument(invalidSettings)).toThrow();
	});

	test("migrates legacy unversioned documents", () => {
		const legacy = { id: "legacy-1", name: "Legacy", timestamp: 123, settings: createDefaultGameSettings(), snapshot: {} };
		const migrated = migrateDocument(legacy);
		expect(migrated.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
	});
});
