import { expect, test } from "bun:test";
import { DOCUMENT_SCHEMA_VERSION, migrateDocument } from "../src/contracts/documents.ts";

test("legacy game, map, item, hazard, AI, and replay documents migrate to version one", () => {
	for (const document of [
		{ id: "game" },
		{ id: "map" },
		{ id: "item", type: "anchor" },
		{ id: "hazard", type: "force" },
		{ id: "ai", difficulty: "easy" },
		{ initialSettings: {}, turns: [] },
	]) expect(migrateDocument(document)).toMatchObject({ schemaVersion: DOCUMENT_SCHEMA_VERSION });
});

test("version migration preserves version-one documents and rejects unknown versions", () => {
	expect(migrateDocument({ schemaVersion: 1, id: "map" })).toEqual({ schemaVersion: 1, id: "map" });
	expect(() => migrateDocument({ schemaVersion: 2 })).toThrow("Unsupported document schema version: 2");
});
