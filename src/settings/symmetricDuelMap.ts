import type { MapDocument } from "../contracts/documents.js";
import type { Vector2D } from "@coffeemakerstudio/bean";
import { kore } from "../kore/sdk/index.js";
import { FRICTION_TABLE } from "./settings.js";
import { addOpenPerimeterWalls } from "../content/maps/perimeterWalls.js";

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
	const map = kore.createDefaultMap({ id: "symmetric-duel", name: "Symmetric Duel", description: "Open mirrored duel ring with one central wall; knock the opponent out of the arena.", worldSize, friction: FRICTION_TABLE.ice });
	addOpenPerimeterWalls(map, worldSize);
	map.addPlayerSpawn({ teamNr: 0, x: 138 * scaleX, y: 138 * scaleY, w: 200 * scaleX, h: 350 * scaleY, playerCount: 1 });
	map.addPlayerSpawn({ teamNr: 1, x: 638 * scaleX, y: 138 * scaleY, w: 200 * scaleX, h: 350 * scaleY, playerCount: 1 });
	return map.addRectangle({ x: 360 * scaleX, y: 126 * scaleY, w: 80 * scaleX, h: 48 * scaleY }).addKillZone({ id: "symmetric-center-death", x: 400 * scaleX, y: 225 * scaleY, r: 27 * Math.min(scaleX, scaleY), color: "#b9472f" }).buildMapDocument();
}
