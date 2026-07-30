import { test, expect, describe } from "bun:test";
import { LocalMatchStorage } from "../src/persistence/storage.js";
import { createDefaultGameSettings } from "../src/settings/settings.js";

describe("Local Match Restoration", () => {
	test("restores saved match settings and snapshot through settings validator", () => {
		const storage = new LocalMatchStorage();
		const settings = createDefaultGameSettings();
		const snapshot = { turnNumber: 2, activeTeam: 1 };

		storage.saveMatch("slot-rest", "Restoration Test", settings, snapshot);

		const restored = storage.restoreMatch("slot-rest");
		expect(restored).toBeDefined();
		expect(restored?.settings.id).toBe(settings.id);
		expect(restored?.snapshot).toEqual(snapshot);

		const missing = storage.restoreMatch("non-existent");
		expect(missing).toBeUndefined();
	});
});
