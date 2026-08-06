import { DOCUMENT_SCHEMA_VERSION, type MapDocument } from "../contracts/documents.js";
import { SHAPE, type Vector2D } from "../physics/physics.js";
import { FRICTION_TABLE, type MapBoundarySettingsRect } from "./settings.js";

const blueprint = { x: 800, y: 450 };

/** Builds Frostbite Arena from the current ice arena's two-sided obstacle layout. */
export function createFrostbiteArenaMap(worldSize: Vector2D): MapDocument {
	if (!Number.isFinite(worldSize.x) || !Number.isFinite(worldSize.y) || worldSize.x <= 0 || worldSize.y <= 0) throw new Error("Frostbite Arena requires a positive world size")
	const scaleX = worldSize.x / blueprint.x;
	const scaleY = worldSize.y / blueprint.y;
	const rect = (x: number, y: number, w: number, h: number): MapBoundarySettingsRect => ({ type: SHAPE.RECTANGLE, x: x * scaleX, y: y * scaleY, w: w * scaleX, h: h * scaleY, effects: [] });
	return {
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		metadata: { id: "frostbite-arena", name: "Frostbite Arena", description: "Extreme low-friction arena with forced directional drift." },
		worldSize: { ...worldSize },
		friction: { ...FRICTION_TABLE.ice },
		drift: 1,
		arenaGeometry: [{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: worldSize.x, h: worldSize.y, role: "containment", effects: [] }, rect(66, 90, 10, 270), rect(100, 50, 270, 10), rect(425, 55, 270, 10), rect(100, 385, 270, 10), rect(425, 385, 270, 10), rect(725, 90, 10, 270), rect(400, 150, 10, 150)],
		spawnRegions: [{ team: 0, x: 120 * scaleX, y: 120 * scaleY, w: 200 * scaleX, h: 350 * scaleY }, { team: 1, x: 560 * scaleX, y: 120 * scaleY, w: 200 * scaleX, h: 350 * scaleY }],
		hazards: [],
	};
}
