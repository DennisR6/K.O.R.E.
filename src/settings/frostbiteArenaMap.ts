import type { MapDocument } from "../contracts/documents.js";
import type { Vector2D } from "../physics/physics.js";
import { kore } from "../kore/sdk/index.js";
import { FRICTION_TABLE } from "./settings.js";

const blueprint = { x: 800, y: 450 };

/** Builds Frostbite Arena from the current ice arena's two-sided obstacle layout. */
export function createFrostbiteArenaMap(worldSize: Vector2D): MapDocument {
	if (!Number.isFinite(worldSize.x) || !Number.isFinite(worldSize.y) || worldSize.x <= 0 || worldSize.y <= 0) throw new Error("Frostbite Arena requires a positive world size")
	const scaleX = worldSize.x / blueprint.x;
	const scaleY = worldSize.y / blueprint.y;
	const map = kore.createDefaultMap({ id: "frostbite-arena", name: "Frostbite Arena", description: "Extreme low-friction arena with forced directional drift.", worldSize, friction: FRICTION_TABLE.ice, drift: 1 });
	const rect = (x: number, y: number, w: number, h: number) => map.addRectangle({ x: x * scaleX, y: y * scaleY, w: w * scaleX, h: h * scaleY });
	map.addPlayerSpawn({ teamNr: 0, x: 120 * scaleX, y: 120 * scaleY, w: 200 * scaleX, h: 350 * scaleY, playerCount: 1 });
	map.addPlayerSpawn({ teamNr: 1, x: 560 * scaleX, y: 120 * scaleY, w: 200 * scaleX, h: 350 * scaleY, playerCount: 1 });
	return rect(66, 90, 10, 270).addRectangle({ x: 100 * scaleX, y: 50 * scaleY, w: 270 * scaleX, h: 10 * scaleY }).addRectangle({ x: 425 * scaleX, y: 55 * scaleY, w: 270 * scaleX, h: 10 * scaleY }).addRectangle({ x: 100 * scaleX, y: 385 * scaleY, w: 270 * scaleX, h: 10 * scaleY }).addRectangle({ x: 425 * scaleX, y: 385 * scaleY, w: 270 * scaleX, h: 10 * scaleY }).addRectangle({ x: 725 * scaleX, y: 90 * scaleY, w: 10 * scaleX, h: 270 * scaleY }).addRectangle({ x: 400 * scaleX, y: 150 * scaleY, w: 10 * scaleX, h: 150 * scaleY }).buildMapDocument();
}
