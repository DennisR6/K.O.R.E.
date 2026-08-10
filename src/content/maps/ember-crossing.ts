import type { MapDocument } from "../../contracts/documents.js";
import type { Vector2D } from "../../physics/physics.js";
import { kore } from "../../kore/sdk/index.js";
import { FRICTION_TABLE } from "../../settings/settings.js";
import { addOpenPerimeterWalls } from "./perimeterWalls.js";

/** Mirrored hazard map; the center zones leave safe north and south crossings. */
export function createEmberCrossingMap(worldSize: Vector2D = { x: 800, y: 450 }): MapDocument {
	const map = kore.createDefaultMap({ id: "ember-crossing", name: "Ember Crossing", description: "A mirrored crossing with two center hazards and safe outer routes.", worldSize, friction: FRICTION_TABLE.tiles });
	map.addPlayerSpawn({ teamNr: 0, x: 100, y: 155, w: 130, h: 140, playerCount: 1 });
	map.addPlayerSpawn({ teamNr: 1, x: worldSize.x - 230, y: 155, w: 130, h: 140, playerCount: 1 });
	const sx = worldSize.x / 800;
	const sy = worldSize.y / 450;
	const scale = Math.min(sx, sy);
	addOpenPerimeterWalls(map, worldSize);
	return map
		.addKillZone({ id: "ember-west", x: 310 * sx, y: 225 * sy, r: 22 * scale, color: "#b9472f" })
		.addKillZone({ id: "ember-east", x: 490 * sx, y: 225 * sy, r: 22 * scale, color: "#b9472f" })
		.buildMapDocument();
}
