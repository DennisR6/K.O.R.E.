import { test, expect, describe } from "bun:test";
import { validateReplayDocument } from "../src/replay/types.js";
import { createDefaultGameSettings } from "../src/settings/settings.js";
import { DOCUMENT_SCHEMA_VERSION } from "../src/contracts/documents.js";

describe("Define Replay Format", () => {
	test("validates a correct replay document", () => {
		const replay = {
			schemaVersion: DOCUMENT_SCHEMA_VERSION,
			initialSettings: createDefaultGameSettings(),
			seed: 12345,
			actions: [
				{ type: "shoot" as const, actorId: "actor-1", input: { angle: 90, power: 5 } }
			]
		};

		expect(() => validateReplayDocument(replay)).not.toThrow();
	});

	test("rejects malformed replay documents", () => {
		const badVersion = {
			schemaVersion: 99,
			initialSettings: createDefaultGameSettings(),
			seed: 12345,
			actions: []
		};
		expect(() => validateReplayDocument(badVersion)).toThrow();

		const missingSeed = {
			schemaVersion: DOCUMENT_SCHEMA_VERSION,
			initialSettings: createDefaultGameSettings(),
			actions: []
		};
		expect(() => validateReplayDocument(missingSeed)).toThrow();
	});
});
