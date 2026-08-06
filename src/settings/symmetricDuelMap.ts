import { DOCUMENT_SCHEMA_VERSION, type MapDocument } from "../contracts/documents.js";
import { SHAPE, type Vector2D } from "../physics/physics.js";
import { FRICTION_TABLE, type MapBoundarySettingsRect } from "./settings.js";

const blueprint = { x: 800, y: 450 };

/**
 * Builds Symmetric Duel: a low-complexity open duel ring with a single
 * central wall. The spawn points mirror left/right, both teams stand at the
 * same distance from the central wall and from the arena walls, and the
 * central wall blocks every straight first-turn line between the two spawn
 * circles. The terminal route is the arena wall: a puck driven into an outer
 * wall leaves the containment region (the engine kills entities whose full
 * circle exits the containment rect), which is a broad route that never
 * depends on pixel-exact input. Spawn points sit 138 px from the outer walls,
 * beyond the ~123 px power-2 stop distance, so ordinary weak openings can
 * never reach a wall themselves.
 */
export function createSymmetricDuelMap(worldSize: Vector2D): MapDocument {
	if (!Number.isFinite(worldSize.x) || !Number.isFinite(worldSize.y) || worldSize.x <= 0 || worldSize.y <= 0) throw new Error("Symmetric Duel requires a positive world size")
	const scaleX = worldSize.x / blueprint.x;
	const scaleY = worldSize.y / blueprint.y;
	const rect = (x: number, y: number, w: number, h: number): MapBoundarySettingsRect => ({ type: SHAPE.RECTANGLE, x: x * scaleX, y: y * scaleY, w: w * scaleX, h: h * scaleY, effects: [] });
	// The central wall spans x 360..440, y 126..174 at the blueprint scale.
	// The spawn circles (radius 12 at x 150/650, y 150) cross the wall plane
	// at y 138..162, so every direct line between the spawns is blocked with a
	// 12 px margin while the routes around the wall stay ~126 px wide.
	const wall = rect(360, 126, 80, 48);
	return {
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		metadata: { id: "symmetric-duel", name: "Symmetric Duel", description: "Open mirrored duel ring with one central wall; knock the opponent out of the arena." },
		worldSize: { ...worldSize },
		friction: { ...FRICTION_TABLE.ice },
		drift: 0,
		arenaGeometry: [
			{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: worldSize.x, h: worldSize.y, role: "containment", effects: [] },
			wall,
		],
		spawnRegions: [{ team: 0, x: 138 * scaleX, y: 138 * scaleY, w: 200 * scaleX, h: 350 * scaleY }, { team: 1, x: 638 * scaleX, y: 138 * scaleY, w: 200 * scaleX, h: 350 * scaleY }],
		hazards: [],
	};
}
