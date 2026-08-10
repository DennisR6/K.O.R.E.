import type { MapDocument } from "../contracts/documents.js";
import type { Vector2D } from "../physics/physics.js";
import { kore } from "../kore/sdk/index.js";
import { FRICTION_TABLE } from "./settings.js";
import { addOpenPerimeterWalls } from "../content/maps/perimeterWalls.js";

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
	const map = kore.createDefaultMap({ id: "structure-control", name: "Structure Control", description: "Mirrored arena shaped by solid columns, rebounds, and protected pockets; use the lanes to outmaneuver the opponent.", worldSize, friction: FRICTION_TABLE.billiards });
	addOpenPerimeterWalls(map, worldSize);
	const rect = (x: number, y: number, w: number, h: number) => map.addRectangle({ x: x * scaleX, y: y * scaleY, w: w * scaleX, h: h * scaleY });
	map.addPlayerSpawn({ teamNr: 0, x: 138 * scaleX, y: 213 * scaleY, w: 200 * scaleX, h: 350 * scaleY, playerCount: 1 });
	map.addPlayerSpawn({ teamNr: 1, x: 638 * scaleX, y: 213 * scaleY, w: 200 * scaleX, h: 350 * scaleY, playerCount: 1 });
	return rect(300, 70, 16, 80).addRectangle({ x: 300 * scaleX, y: 300 * scaleY, w: 16 * scaleX, h: 80 * scaleY }).addRectangle({ x: 484 * scaleX, y: 70 * scaleY, w: 16 * scaleX, h: 80 * scaleY }).addRectangle({ x: 484 * scaleX, y: 300 * scaleY, w: 16 * scaleX, h: 80 * scaleY }).addRectangle({ x: 392 * scaleX, y: 213 * scaleY, w: 16 * scaleX, h: 24 * scaleY }).addKillZone({ id: "structure-control-center-death", x: 400 * scaleX, y: 175 * scaleY, r: 24 * Math.min(scaleX, scaleY), color: "#b9472f" }).buildMapDocument();
}
