import { expect, test } from "bun:test";
import { DOCUMENT_SCHEMA_VERSION, type EditorMapDocument, validateEditorMapDocument } from "../src/contracts/documents.ts";

const editorMap: EditorMapDocument = {
	schemaVersion: DOCUMENT_SCHEMA_VERSION,
	name: "Editor fixture",
	background: null,
	screenResolution: { x: 1600, y: 900, factor: 100 },
	mapBoundarys: [{ type: "rectangle", x: 10, y: 20, w: 100, h: 20, color: "#4da3ff" }],
	holes: [{ type: "circle", x: 300, y: 200, r: 30, color: "#ff4444" }],
	players: [{ x: 50, y: 60, color: "#00ff00", team: 0 }],
	friction: { friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 },
	drift: 0,
	items: [{
		id: "item_push",
		name: "Push",
		effectType: "push",
		trigger: "onUse",
		frequency: { mode: "rundenbasiert", intervalRounds: 3, killsInterval: 3, lastPlayersThreshold: 0, healthThreshold: 20, boostFactor: 5 },
		probability: 25,
		spawn: { type: "points", points: [{ x: 10, y: 20 }], areas: [{ shape: "circle", x: 0, y: 0, radius: 100, width: 200, height: 200 }] },
		effectParams: { force: 500 },
	}],
	effects: [{ id: "hazard_push", type: "push_zone", position: { x: 0, y: 0 }, size: { w: 2, h: 2 }, params: { direction: 0, force: 1 } }],
	mode: { type: "last_man_standing", params: { itemsEnabled: true, hazardsEnabled: false, allowTies: false } },
	ai: { difficulty: "normal", aggressiveness: 50, riskTaking: 40, itemPriority: 50, hazardAwareness: 60, errorRate: 20 },
};

test("validates a versioned standalone editor map without treating it as GameSettings", () => {
	expect(() => validateEditorMapDocument(editorMap)).not.toThrow();
});

test("rejects invalid editor shapes, numeric values, and collections", () => {
	expect(() => validateEditorMapDocument({ ...editorMap, mapBoundarys: [{ ...editorMap.mapBoundarys[0], type: "circle" }] })).toThrow("Invalid editor map geometry");
	expect(() => validateEditorMapDocument({ ...editorMap, holes: [{ ...editorMap.holes[0], r: 0 }] })).toThrow("Invalid editor map geometry");
	expect(() => validateEditorMapDocument({ ...editorMap, friction: 1 })).toThrow("Invalid editor map physics");
	expect(() => validateEditorMapDocument({ ...editorMap, items: {} })).toThrow("Invalid editor map collections");
	expect(() => validateEditorMapDocument({ ...editorMap, effects: [{ ...editorMap.effects[0], params: { direction: 361, force: 1 } }] })).toThrow("Invalid editor map collection entry");
});
