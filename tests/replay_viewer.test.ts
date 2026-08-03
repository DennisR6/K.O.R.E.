import { test, expect, describe } from "bun:test";
import { ReplayViewer } from "../src/menu/replayViewer.js";
import { createDefaultGameSettings } from "../src/settings/settings.js";
import { DOCUMENT_SCHEMA_VERSION } from "../src/contracts/documents.js";
import { GameState } from "../src/engine/types.js";

describe("Replay Viewer", () => {
	test("successfully loads and plays valid replay", () => {
		const viewer = new ReplayViewer();
		const validReplay = {
			schemaVersion: DOCUMENT_SCHEMA_VERSION,
			initialSettings: createDefaultGameSettings(),
			seed: 123,
			actions: [],
		};

		const success = viewer.loadReplay(validReplay);
		expect(success).toBe(true);
		expect(viewer.getErrorState()).toBeNull();
		expect(viewer.getPlayer()).toBeDefined();
	});

	test("captures malformed or incompatible replay error state", () => {
		const viewer = new ReplayViewer();
		const invalidReplay = {
			schemaVersion: 999,
			initialSettings: null,
			seed: "invalid",
			actions: null,
		};

		const success = viewer.loadReplay(invalidReplay);
		expect(success).toBe(false);
		expect(viewer.getErrorState()).not.toBeNull();
		expect(viewer.getPlayer()).toBeUndefined();
	});

	test("starts a replay action visibly instead of resolving the entire replay immediately", () => {
		const settings = createDefaultGameSettings();
		const viewer = new ReplayViewer();
		expect(viewer.loadReplay({
			schemaVersion: DOCUMENT_SCHEMA_VERSION,
			initialSettings: settings,
			seed: 123,
			actions: [{ type: "shoot", actorId: settings.players[0]!.id, input: { angle: 0, power: 1 } }],
		})).toBe(true);
		expect(viewer.getPlayer()!.getHandler().getState()).toBe(GameState.Playing);
		expect(viewer.getPlayer()!.isComplete()).toBe(false);
	});
});
