import { DOCUMENT_SCHEMA_VERSION, type MapDocument } from "../contracts/documents.js";
import { SHAPE, type Vector2D } from "../physics/physics.js";
import { FRICTION_TABLE } from "./settings.js";

const blueprint = { x: 800, y: 450 };

/**
 * Builds Hazard Control, a mirrored arena whose primary terminal pressure is
 * a pair of lethal kill zones guarding the center corridor.
 *
 * The two mirrored kill zones sit directly on the line between the spawns, so
 * every straight crossing is a self-eliminating gamble: the shooter's own puck
 * dies in the near zone before it can reach the opponent. The opponent is
 * protected by its own zone and can only be eliminated by flanking around the
 * zones (north or south lane) and driving it backward into the zone, or by its
 * own misplay. The arena walls remain the containment kill boundary.
 */
export function createHazardControlMap(worldSize: Vector2D): MapDocument {
	if (!Number.isFinite(worldSize.x) || !Number.isFinite(worldSize.y) || worldSize.x <= 0 || worldSize.y <= 0) throw new Error("Hazard Control requires a positive world size")
	const scaleX = worldSize.x / blueprint.x;
	const scaleY = worldSize.y / blueprint.y;
	const scale = Math.min(scaleX, scaleY);
	const zone = (x: number, y: number, r: number) => ({ x: x * scaleX, y: y * scaleY, r: r * scale });
	return {
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		metadata: { id: "hazard-control", name: "Hazard Control", description: "A mirrored arena whose center corridor is guarded by two lethal kill zones; flank and drive opponents backward into the hazard." },
		worldSize: { ...worldSize },
		friction: { ...FRICTION_TABLE.tiles },
		drift: 0,
		arenaGeometry: [{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: worldSize.x, h: worldSize.y, role: "containment", effects: [] }],
		spawnRegions: [{ team: 0, x: 138 * scaleX, y: 213 * scaleY, w: 200 * scaleX, h: 350 * scaleY }, { team: 1, x: 638 * scaleX, y: 213 * scaleY, w: 200 * scaleX, h: 350 * scaleY }],
		hazards: [
			{ schemaVersion: DOCUMENT_SCHEMA_VERSION, id: "west-kill", type: "kill-zone", trigger: { type: "collision" }, config: zone(300, 225, 28) },
			{ schemaVersion: DOCUMENT_SCHEMA_VERSION, id: "east-kill", type: "kill-zone", trigger: { type: "collision" }, config: zone(500, 225, 28) },
		],
	};
}
