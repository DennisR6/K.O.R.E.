import type { MapDocument } from "../../contracts/documents.js";
import type { Vector2D } from "@coffeemakerstudio/bean";
import { kore } from "../../kore/sdk/index.js";
import { FRICTION_TABLE } from "../../settings/settings.js";
import { addOpenPerimeterWalls } from "./perimeterWalls.js";

/** Mirrored gate layout with three navigable lanes around a central bar. */
export function createLanternGatesMap(worldSize: Vector2D = { x: 800, y: 450 }): MapDocument {
	const map = kore.createDefaultMap({ id: "lantern-gates", name: "Lantern Gates", description: "A symmetric gatehouse where top, middle, and bottom lanes remain open.", worldSize, friction: FRICTION_TABLE.billiards });
	map.addPlayerSpawn({ teamNr: 0, x: 100, y: 155, w: 130, h: 140, playerCount: 1 });
	map.addPlayerSpawn({ teamNr: 1, x: worldSize.x - 230, y: 155, w: 130, h: 140, playerCount: 1 });
	const sx = worldSize.x / 800;
	const sy = worldSize.y / 450;
	addOpenPerimeterWalls(map, worldSize);
	return map
		.addRectangle({ x: 350 * sx, y: 75 * sy, w: 100 * sx, h: 28 * sy, color: "#315b7d" })
		.addRectangle({ x: 350 * sx, y: 347 * sy, w: 100 * sx, h: 28 * sy, color: "#315b7d" })
		.addRectangle({ x: 350 * sx, y: 154 * sy, w: 12 * sx, h: 142 * sy, color: "#315b7d" })
		.addRectangle({ x: 438 * sx, y: 154 * sy, w: 12 * sx, h: 142 * sy, color: "#315b7d" })
		.addRectangle({ x: 350 * sx, y: 154 * sy, w: 100 * sx, h: 12 * sy, color: "#315b7d" })
		.addKillZone({ id: "lantern-center-death", x: 400 * sx, y: 225 * sy, r: 27 * Math.min(sx, sy), color: "#b9472f" })
		.buildMapDocument();
}
