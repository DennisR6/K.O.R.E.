import type { MapDocument } from "../contracts/documents.js";
import type { Vector2D } from "../physics/physics.js";
import { kore } from "../kore/sdk/index.js";
import { FRICTION_TABLE } from "./settings.js";

const blueprint = { x: 800, y: 450 };

/** Builds Magma Cradle from the current ice arena layout with hazardous vents and lava pools. */
export function createMagmaCradleMap(worldSize: Vector2D): MapDocument {
	if (!Number.isFinite(worldSize.x) || !Number.isFinite(worldSize.y) || worldSize.x <= 0 || worldSize.y <= 0) throw new Error("Magma Cradle requires a positive world size")
	const scaleX = worldSize.x / blueprint.x;
	const scaleY = worldSize.y / blueprint.y;
	const scale = Math.min(scaleX, scaleY);
	const map = kore.createDefaultMap({ id: "magma-cradle", name: "Magma Cradle", description: "A hot arena with volcanic vents and lethal lava pools.", worldSize, friction: FRICTION_TABLE.tiles });
	const rect = (x: number, y: number, w: number, h: number) => map.addRectangle({ x: x * scaleX, y: y * scaleY, w: w * scaleX, h: h * scaleY });
	map.addPlayerSpawn({ teamNr: 0, x: 120 * scaleX, y: 120 * scaleY, w: 200 * scaleX, h: 350 * scaleY, playerCount: 1 });
	map.addPlayerSpawn({ teamNr: 1, x: 560 * scaleX, y: 120 * scaleY, w: 200 * scaleX, h: 350 * scaleY, playerCount: 1 });
	return rect(66, 90, 10, 270).addRectangle({ x: 100 * scaleX, y: 50 * scaleY, w: 270 * scaleX, h: 10 * scaleY }).addRectangle({ x: 425 * scaleX, y: 55 * scaleY, w: 270 * scaleX, h: 10 * scaleY }).addRectangle({ x: 100 * scaleX, y: 385 * scaleY, w: 270 * scaleX, h: 10 * scaleY }).addRectangle({ x: 425 * scaleX, y: 385 * scaleY, w: 270 * scaleX, h: 10 * scaleY }).addRectangle({ x: 725 * scaleX, y: 90 * scaleY, w: 10 * scaleX, h: 270 * scaleY }).addRectangle({ x: 400 * scaleX, y: 150 * scaleY, w: 10 * scaleX, h: 150 * scaleY }).addForceZone({ id: "west-vent", x: 300 * scaleX, y: 225 * scaleY, r: 28 * scale, angle: 0, power: 4 }).addForceZone({ id: "east-vent", x: 500 * scaleX, y: 225 * scaleY, r: 28 * scale, angle: 180, power: 4 }).addKillZone({ id: "north-lava", x: 390 * scaleX, y: 35 * scaleY, r: 14 * scale }).addKillZone({ id: "south-lava", x: 390 * scaleX, y: 400 * scaleY, r: 14 * scale }).addKillZone({ id: "north-west-corner-lava", x: 40 * scaleX, y: 40 * scaleY, r: 18 * scale }).addKillZone({ id: "north-east-corner-lava", x: 760 * scaleX, y: 40 * scaleY, r: 18 * scale }).addKillZone({ id: "south-west-corner-lava", x: 40 * scaleX, y: 410 * scaleY, r: 18 * scale }).addKillZone({ id: "south-east-corner-lava", x: 760 * scaleX, y: 410 * scaleY, r: 18 * scale }).buildMapDocument();
}
