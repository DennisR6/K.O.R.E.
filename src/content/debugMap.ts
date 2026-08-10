import type { EditorMapDocument } from "../contracts/documents.js";

/** Development map loaded only by the standalone map-builder workflow. */
export const debugMap: EditorMapDocument = {
	schemaVersion: 1,
	name: "Debug Arena",
	background: null,
	screenResolution: { x: 1600, y: 900, factor: 100 },
	mapBoundarys: [],
	holes: [],
	players: [
		{ x: 180, y: 225, color: "#4da3ff", team: 0 },
		{ x: 1420, y: 225, color: "#ff6b6b", team: 1 },
	],
	friction: { friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 },
	drift: 0,
	items: [],
	effects: [],
	mode: {
		type: "last_man_standing",
		params: { itemsEnabled: true, hazardsEnabled: false, allowTies: false },
	},
	ai: {
		difficulty: "normal",
		aggressiveness: 50,
		riskTaking: 40,
		itemPriority: 50,
		hazardAwareness: 60,
		errorRate: 20,
	},
};
