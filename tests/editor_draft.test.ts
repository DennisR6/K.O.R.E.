import { expect, test } from "bun:test";
import { EDITOR_DRAFT_STORAGE_KEY, restoreEditorDraft, saveEditorDraft } from "../src-website/js/editor-draft.js";

class MemoryStorage {
	values = new Map<string, string>();

	getItem(key: string) {
		return this.values.get(key) ?? null;
	}

	setItem(key: string, value: string) {
		this.values.set(key, value);
	}
}

function createEditorMap() {
	return {
		schemaVersion: 1,
		name: "Draft map",
		background: null,
		screenResolution: { x: 1600, y: 900, factor: 100 },
		mapBoundarys: [{ type: "rectangle", x: 10, y: 20, w: 100, h: 20, color: "#4da3ff" }],
		holes: [{ type: "circle", x: 300, y: 200, r: 30, color: "#ff4444" }],
		players: [{ x: 50, y: 60, color: "#00ff00", team: 0 }],
		friction: { friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 },
		drift: 0,
		items: [],
		effects: [],
		mode: { type: "last_man_standing", params: { itemsEnabled: true, hazardsEnabled: false, allowTies: false } },
		ai: { difficulty: "normal", aggressiveness: 50, riskTaking: 40, itemPriority: 50, hazardAwareness: 60, errorRate: 20 },
	};
}

test("temporary editor drafts validate before saving", () => {
	const storage = new MemoryStorage();
	const invalidMap = { ...createEditorMap(), drift: 2 };

	expect(() => saveEditorDraft(invalidMap, storage)).toThrow("Invalid editor map physics");
	expect(storage.values).toHaveLength(0);
});

test("temporary editor drafts round trip into the existing map object", () => {
	const storage = new MemoryStorage();
	const savedMap = createEditorMap();
	const restoredMap = { stale: true } as Record<string, unknown>;
	const restoredReference = restoredMap;

	expect(saveEditorDraft(savedMap, storage)).toBe(true);
	expect(restoreEditorDraft(restoredMap, storage)).toBe(true);
	expect(restoredMap).toBe(restoredReference);
	expect(restoredMap).toEqual(savedMap);
});

test("temporary editor draft restoration ignores missing and malformed storage", () => {
	const storage = new MemoryStorage();
	const mapData = { unchanged: true } as Record<string, unknown>;

	expect(restoreEditorDraft(mapData, storage)).toBe(false);
	expect(mapData).toEqual({ unchanged: true });
	storage.setItem(EDITOR_DRAFT_STORAGE_KEY, "not json");
	expect(restoreEditorDraft(mapData, storage)).toBe(false);
	expect(mapData).toEqual({ unchanged: true });
	storage.setItem(EDITOR_DRAFT_STORAGE_KEY, "{}");
	expect(restoreEditorDraft(mapData, storage)).toBe(false);
	expect(mapData).toEqual({ unchanged: true });
	expect(restoreEditorDraft(mapData, null)).toBe(false);
	expect(saveEditorDraft(createEditorMap(), null)).toBe(false);
});
