import { DOCUMENT_SCHEMA_VERSION, type MapDocument } from "../contracts/documents.js";
import { SHAPE, type Vector2D } from "../physics/physics.js";
import { FRICTION_TABLE, type MapBoundarySettingsRect } from "./settings.js";

const blueprint = { x: 800, y: 450 };

/** Builds Magma Cradle from the current ice arena layout with hazardous vents and lava pools. */
export function createMagmaCradleMap(worldSize: Vector2D): MapDocument {
	if (!Number.isFinite(worldSize.x) || !Number.isFinite(worldSize.y) || worldSize.x <= 0 || worldSize.y <= 0) throw new Error("Magma Cradle requires a positive world size")
	const scaleX = worldSize.x / blueprint.x;
	const scaleY = worldSize.y / blueprint.y;
	const scale = Math.min(scaleX, scaleY);
	const rect = (x: number, y: number, w: number, h: number): MapBoundarySettingsRect => ({ type: SHAPE.RECTANGLE, x: x * scaleX, y: y * scaleY, w: w * scaleX, h: h * scaleY, effects: [] });
	const zone = (x: number, y: number, r: number) => ({ x: x * scaleX, y: y * scaleY, r: r * scale });
	return {
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		metadata: { id: "magma-cradle", name: "Magma Cradle", description: "A hot arena with volcanic vents and lethal lava pools." },
		worldSize: { ...worldSize },
		friction: { ...FRICTION_TABLE.tiles },
		drift: 0,
		arenaGeometry: [{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: worldSize.x, h: worldSize.y, role: "containment", effects: [] }, rect(66, 90, 10, 270), rect(100, 50, 270, 10), rect(425, 55, 270, 10), rect(100, 385, 270, 10), rect(425, 385, 270, 10), rect(725, 90, 10, 270), rect(400, 150, 10, 150)],
		spawnRegions: [{ team: 0, x: 120 * scaleX, y: 120 * scaleY, w: 200 * scaleX, h: 350 * scaleY }, { team: 1, x: 560 * scaleX, y: 120 * scaleY, w: 200 * scaleX, h: 350 * scaleY }],
		hazards: [
			{ schemaVersion: DOCUMENT_SCHEMA_VERSION, id: "west-vent", type: "force", trigger: { type: "collision" }, config: { ...zone(300, 225, 28), angle: 0, power: 4 } },
			{ schemaVersion: DOCUMENT_SCHEMA_VERSION, id: "east-vent", type: "force", trigger: { type: "collision" }, config: { ...zone(500, 225, 28), angle: 180, power: 4 } },
			{ schemaVersion: DOCUMENT_SCHEMA_VERSION, id: "north-lava", type: "kill-zone", trigger: { type: "collision" }, config: zone(390, 35, 14) },
			{ schemaVersion: DOCUMENT_SCHEMA_VERSION, id: "south-lava", type: "kill-zone", trigger: { type: "collision" }, config: zone(390, 400, 14) },
		],
	};
}
