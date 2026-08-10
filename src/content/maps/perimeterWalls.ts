import type { Vector2D } from "../../physics/physics.js";
import type { KoreMapBuilder } from "../../kore/sdk/index.js";

/** Adds a continuous four-sided perimeter for visible puck rebounds. */
export function addOpenPerimeterWalls(map: KoreMapBuilder, worldSize: Vector2D, color = "#315b7d"): KoreMapBuilder {
	const scale = Math.min(worldSize.x / 800, worldSize.y / 450);
	const thickness = 8 * scale;
	map.addRectangle({ x: 0, y: 0, w: worldSize.x, h: thickness, color });
	map.addRectangle({ x: 0, y: worldSize.y - thickness, w: worldSize.x, h: thickness, color });
	map.addRectangle({ x: 0, y: 0, w: thickness, h: worldSize.y, color });
	map.addRectangle({ x: worldSize.x - thickness, y: 0, w: thickness, h: worldSize.y, color });
	return map;
}
