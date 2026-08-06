import { test, expect, describe } from "bun:test";
import { exportGameSettings, importGameSettings } from "../src/persistence/export.js";
import { createDefaultGameSettings } from "../src/settings/settings.js";
import { DOCUMENT_SCHEMA_VERSION } from "../src/contracts/documents.js";

describe("Version Game Settings Exports", () => {
	test("exports and imports game settings successfully", () => {
		const settings = createDefaultGameSettings();
		const envelope = exportGameSettings(settings);

		expect(envelope.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
		expect(envelope.exportedAt).toBeTypeOf("number");
		expect(envelope.settings).toBeDefined();

		const imported = importGameSettings(envelope);
		expect(imported.id).toBe(settings.id);
		expect(imported.playerCount).toBe(settings.playerCount);
	});

	test("rejects malformed export envelopes", () => {
		const badVersion = { schemaVersion: 99, exportedAt: Date.now(), settings: createDefaultGameSettings() };
		expect(() => importGameSettings(badVersion)).toThrow();

		const badTimestamp = { schemaVersion: DOCUMENT_SCHEMA_VERSION, exportedAt: "not-a-number", settings: createDefaultGameSettings() };
		expect(() => importGameSettings(badTimestamp)).toThrow();

		const badSettings = { schemaVersion: DOCUMENT_SCHEMA_VERSION, exportedAt: Date.now(), settings: { schemaVersion: 99 } };
		expect(() => importGameSettings(badSettings)).toThrow();
	});
});
