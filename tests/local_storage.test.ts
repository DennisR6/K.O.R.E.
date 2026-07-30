import { test, expect, describe } from "bun:test";
import { LocalMatchStorage } from "../src/persistence/storage.js";
import { createDefaultGameSettings } from "../src/settings/settings.js";

describe("Local Match Storage", () => {
	test("saves, retrieves, lists, and deletes local match save slots", () => {
		const storage = new LocalMatchStorage();
		const settings = createDefaultGameSettings();
		const snapshot = { turnNumber: 1 };

		const slot = storage.saveMatch("match-1", "First Match", settings, snapshot);
		expect(slot.id).toBe("match-1");
		expect(slot.name).toBe("First Match");

		const retrieved = storage.getSlot("match-1");
		expect(retrieved).toBeDefined();
		expect(retrieved?.id).toBe("match-1");

		const list = storage.listSlots();
		expect(list.length).toBe(1);
		expect(list[0]?.id).toBe("match-1");

		const deleted = storage.deleteSlot("match-1");
		expect(deleted).toBe(true);
		expect(storage.getSlot("match-1")).toBeUndefined();
		expect(storage.listSlots().length).toBe(0);
	});
});
