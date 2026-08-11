import { expect, test } from "bun:test";
import { DOCUMENT_SCHEMA_VERSION, loadMapDocument, type MapDocument } from "../src/contracts/documents.ts";
import { SHAPE } from "@coffeemakerstudio/bean";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

const map: MapDocument = {
	schemaVersion: DOCUMENT_SCHEMA_VERSION,
	metadata: { id: "test", name: "Test" },
	worldSize: { x: 200, y: 100 },
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
	// Uncolored solid geometry gets the default render color (17.8), so the
	// loader output is the arena geometry with that color applied.
	expect(settings.mapBoundarys).toMatchObject(map.arenaGeometry.map(boundary => ({ ...boundary, color: "#315b7d" })));
	expect(settings.players.map(player => player.position)).toEqual([{ x: 22, y: 22 }, { x: 152, y: 22 }]);
});

test("map loader applies an explicit canonical map background", () => {
		const withBackground: MapDocument = { ...map, background: { type: "color", color: "blue" } };
		const settings = loadMapDocument(withBackground, createDefaultGameSettings(2, 1));

		expect(settings.background).toEqual({ type: "color", color: "blue" });
});

test("map loader keeps the containment boundary invisible and hazard colors", () => {
	const withContainment: MapDocument = {
		...map,
		arenaGeometry: [
			{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 200, h: 100, role: "containment", effects: [] },
			{ type: SHAPE.RECTANGLE, x: 10, y: 10, w: 20, h: 20, effects: [] },
			{ type: SHAPE.RECTANGLE, x: 40, y: 10, w: 20, h: 20, color: "#abcdef", effects: [] },
		],
		hazards: [{ schemaVersion: DOCUMENT_SCHEMA_VERSION, id: "kill", type: "kill-zone", trigger: { type: "collision" }, config: { x: 100, y: 50, r: 10 } }],
	};
	const settings = loadMapDocument(withContainment, createDefaultGameSettings(2, 1));
	expect(settings.mapBoundarys[0]!.color).toBeUndefined();
	expect(settings.mapBoundarys[1]!.color).toBe("#315b7d");
	expect(settings.mapBoundarys[2]!.color).toBe("#abcdef");
	expect(settings.mapBoundarys[3]!.color).toBe("#d94b28");
});

test("map loader rejects unsupported map hazards", () => {
	expect(() => loadMapDocument({ ...map, hazards: [{ schemaVersion: 1, id: "void", type: "unknown", trigger: { type: "collision" }, config: { x: 50, y: 50, r: 10 } }] }, createDefaultGameSettings(2, 1)))
		.toThrow("Invalid map hazard");
});
