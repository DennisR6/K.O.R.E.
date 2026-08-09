import type { MapDocument } from "../../contracts/documents.js";
import type { Vector2D } from "../../physics/physics.js";
import { kore } from "../../kore/sdk/index.js";
import { FRICTION_TABLE } from "../../settings/settings.js";

/** Open mirrored arena with two central islands and broad side lanes. */
export function createAuroraBasinMap(worldSize: Vector2D = { x: 800, y: 450 }): MapDocument {
	const map = kore.createDefaultMap({ id: "aurora-basin", name: "Aurora Basin", description: "A mirrored basin with two central islands and broad recovery lanes.", worldSize, friction: FRICTION_TABLE.ice });
	map.addPlayerSpawn({ teamNr: 0, x: 100, y: 155, w: 130, h: 140, playerCount: 1 });
	map.addPlayerSpawn({ teamNr: 1, x: worldSize.x - 230, y: 155, w: 130, h: 140, playerCount: 1 });
	const sx = worldSize.x / 800;
	const sy = worldSize.y / 450;
	return map
		.addCircle({ x: 330 * sx, y: 225 * sy, r: 24 * Math.min(sx, sy), color: "#315b7d" })
		.addCircle({ x: 470 * sx, y: 225 * sy, r: 24 * Math.min(sx, sy), color: "#315b7d" })
		.addRectangle({ x: 354 * sx, y: 154 * sy, w: 12 * sx, h: 142 * sy, color: "#315b7d" })
		.addRectangle({ x: 434 * sx, y: 154 * sy, w: 12 * sx, h: 142 * sy, color: "#315b7d" })
		.addKillZone({ id: "aurora-center-death", x: 400 * sx, y: 225 * sy, r: 27 * Math.min(sx, sy), color: "#b9472f" })
		.buildMapDocument();
}
