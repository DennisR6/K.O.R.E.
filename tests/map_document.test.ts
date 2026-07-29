import { expect, test } from "bun:test";
import { DOCUMENT_SCHEMA_VERSION, type MapDocument, validateMapDocument } from "../src/contracts/documents.ts";
import { SHAPE } from "../src/physics/physics.ts";

const map: MapDocument = {
	schemaVersion: DOCUMENT_SCHEMA_VERSION,
	metadata: { id: "ice", name: "Ice Arena" },
	friction: { friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 },
	drift: 0,
	arenaGeometry: [{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 100, h: 100, effects: [] }],
	spawnRegions: [{ team: 0, x: 10, y: 10, w: 20, h: 20 }],
	hazards: [{ schemaVersion: DOCUMENT_SCHEMA_VERSION, id: "void", type: "kill-zone", trigger: { type: "collision" }, config: {} }],
};

test("canonical map schema includes physics, geometry, spawns, hazards, and metadata", () => {
	expect(() => validateMapDocument(map)).not.toThrow();
	expect(() => validateMapDocument({ ...map, drift: 2 })).toThrow("Invalid map physics");
	expect(() => validateMapDocument({ ...map, arenaGeometry: [{ ...map.arenaGeometry[0], w: -1 }] })).toThrow("Invalid map collections");
	expect(() => validateMapDocument({ ...map, spawnRegions: [{ ...map.spawnRegions[0], w: 0 }] })).toThrow("Invalid map spawn region");
	expect(() => validateMapDocument({ ...map, hazards: [{ id: "void", type: "kill-zone" }] })).toThrow("Invalid map hazard");
});
