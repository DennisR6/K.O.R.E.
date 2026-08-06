import { DOCUMENT_SCHEMA_VERSION, type MapDocument } from "../contracts/documents.js";
import { SHAPE, type Vector2D } from "../physics/physics.js";
import { FRICTION_TABLE, type MapBoundarySettingsRect } from "./settings.js";

const blueprint = { x: 800, y: 450 };

/**
 * Builds Structure Control: a mirrored arena whose play is shaped by solid
 * columns, a central blocker, rebounds, and protected pockets.
 *
 * Geometry at the blueprint scale:
 * - containment rect (0, 0, 800, 450): the arena walls are the containment
 *   kill boundary (driving the opponent's puck into an outer wall is the
 *   terminal route);
 * - four columns at x 300..316 / 484..500, y 70..150 and 300..380;
 * - one central blocker at x 392..408, y 213..237.
 *
 * Navigable lanes: the central corridor (x 316..484) with two 63 px gaps
 * around the blocker, the top lane (y 12..70), the bottom lane (y 380..438),
 * and the open side pockets (x 12..300). Every straight line from a spawn
 * circle to the opponent's spawn circle crosses the blocker band, so no
 * legal opening can eliminate the opponent; all structures are small enough
 * that no single one partitions the arena permanently.
 */
export function createStructureControlMap(worldSize: Vector2D): MapDocument {
	if (!Number.isFinite(worldSize.x) || !Number.isFinite(worldSize.y) || worldSize.x <= 0 || worldSize.y <= 0) throw new Error("Structure Control requires a positive world size")
	const scaleX = worldSize.x / blueprint.x;
	const scaleY = worldSize.y / blueprint.y;
	const rect = (x: number, y: number, w: number, h: number): MapBoundarySettingsRect => ({ type: SHAPE.RECTANGLE, x: x * scaleX, y: y * scaleY, w: w * scaleX, h: h * scaleY, effects: [] });
	return {
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		metadata: { id: "structure-control", name: "Structure Control", description: "Mirrored arena shaped by solid columns, rebounds, and protected pockets; use the lanes to outmaneuver the opponent." },
		worldSize: { ...worldSize },
		friction: { ...FRICTION_TABLE.billiards },
		drift: 0,
		arenaGeometry: [
			{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: worldSize.x, h: worldSize.y, role: "containment", effects: [] },
			rect(300, 70, 16, 80),
			rect(300, 300, 16, 80),
			rect(484, 70, 16, 80),
			rect(484, 300, 16, 80),
			rect(392, 213, 16, 24),
		],
		spawnRegions: [{ team: 0, x: 138 * scaleX, y: 213 * scaleY, w: 200 * scaleX, h: 350 * scaleY }, { team: 1, x: 638 * scaleX, y: 213 * scaleY, w: 200 * scaleX, h: 350 * scaleY }],
		hazards: [],
	};
}
