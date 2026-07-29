import { expect, test } from "bun:test";
import { DOCUMENT_SCHEMA_VERSION, loadMapDocument, type MapDocument } from "../src/contracts/documents.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

const map: MapDocument = {
	schemaVersion: DOCUMENT_SCHEMA_VERSION,
	metadata: { id: "test", name: "Test" },
	friction: { friction: 0.9, linearDrag: 0.2, stopThreshold: 0.3 },
	drift: 0.25,
	arenaGeometry: [{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 200, h: 100, effects: [] }],
	spawnRegions: [{ team: 0, x: 10, y: 10, w: 50, h: 50 }, { team: 1, x: 140, y: 10, w: 50, h: 50 }],
	hazards: [],
};

test("map loader applies canonical physics, geometry, and team spawns", () => {
	const settings = loadMapDocument(map, createDefaultGameSettings(2, 1));

	expect(settings.friction).toEqual(map.friction);
	expect(settings.drift).toBe(0.25);
	expect(settings.mapBoundarys).toEqual(map.arenaGeometry);
	expect(settings.players.map(player => player.position)).toEqual([{ x: 22, y: 22 }, { x: 152, y: 22 }]);
});

test("map loader rejects hazard references before hazard runtime mapping exists", () => {
	expect(() => loadMapDocument({ ...map, hazards: [{ schemaVersion: 1, id: "void", type: "kill-zone", trigger: { type: "collision" }, config: {} }] }, createDefaultGameSettings(2, 1)))
		.toThrow("Cannot load map hazards before runtime adapters exist");
});
