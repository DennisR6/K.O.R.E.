import type { MapDocument } from "../contracts/documents.js";
import type { Vector2D } from "../physics/physics.js";
import { kore } from "../kore/sdk/index.js";
import { FRICTION_TABLE } from "./settings.js";
import { AssetList } from "../assetManager/assets/assetRegistry.js";

const blueprint = { x: 800, y: 450 };

/** Builds Magma Cradle from the current ice arena layout with hazardous vents and lava pools. */
export function createMagmaCradleMap(worldSize: Vector2D): MapDocument {
  if (!Number.isFinite(worldSize.x) || !Number.isFinite(worldSize.y) || worldSize.x <= 0 || worldSize.y <= 0) throw new Error("Magma Cradle requires a positive world size")
  const scaleX = worldSize.x / blueprint.x;
  const scaleY = worldSize.y / blueprint.y;
  const scale = Math.min(scaleX, scaleY);
  const map = kore.createDefaultMap({ id: "magma-cradle", name: "Magma Cradle", description: "A hot arena with volcanic vents and lethal lava pools.", worldSize, friction: FRICTION_TABLE.tiles });
  const rect = (x: number, y: number, w: number, h: number, color: string) => map.addRectangle({ x: x * scaleX, y: y * scaleY, w: w * scaleX, h: h * scaleY, color: color });
  map.addPlayerSpawn({ teamNr: 0, x: 120 * scaleX, y: 120 * scaleY, w: 200 * scaleX, h: 350 * scaleY, playerCount: 1 });
  map.addPlayerSpawn({ teamNr: 1, x: 560 * scaleX, y: 120 * scaleY, w: 200 * scaleX, h: 350 * scaleY, playerCount: 1 });
  map.addBackground({ type: "asset", asset: AssetList.slipStirkeMapIceJPG })
  return rect(66, 90, 10, 270, "transparent")
    .addRectangle({ x: 105 * scaleX, y: 55 * scaleY, w: 270 * scaleX, h: 10 * scaleY, color: "transparent" })
    .addRectangle({ x: 425 * scaleX, y: 55 * scaleY, w: 270 * scaleX, h: 10 * scaleY, color: "transparent" })
    .addRectangle({ x: 105 * scaleX, y: 385 * scaleY, w: 270 * scaleX, h: 10 * scaleY, color: "transparent" })
    .addRectangle({ x: 425 * scaleX, y: 385 * scaleY, w: 270 * scaleX, h: 10 * scaleY, color: "transparent" })
    .addRectangle({ x: 723 * scaleX, y: 90 * scaleY, w: 10 * scaleX, h: 270 * scaleY, color: "transparent" })
    .addRectangle({ x: 400 * scaleX, y: 150 * scaleY, w: 10 * scaleX, h: 150 * scaleY, color: "gray" })
    .addForceZone({ id: "west-vent", x: 300 * scaleX, y: 225 * scaleY, r: 28 * scale, angle: 0, power: 4, color: "#07d4f8" })
    .addForceZone({ id: "east-vent", x: 500 * scaleX, y: 225 * scaleY, r: 28 * scale, angle: 180, power: 4, color: "#07d4f8" })
    .addKillZone({ id: "north-lava", x: 400 * scaleX, y: 43 * scaleY, r: 20 * scale, color: "transparent" })
    .addKillZone({ id: "south-lava", x: 400 * scaleX, y: 406 * scaleY, r: 20 * scale, color: "transparent" })
    .addKillZone({ id: "north-west-corner-lava", x: 72 * scaleX, y: 57 * scaleY, r: 20 * scale, color: "transparent" })
    .addKillZone({ id: "north-east-corner-lava", x: 728 * scaleX, y: 57 * scaleY, r: 20 * scale, color: "transparent" })
    .addKillZone({ id: "south-west-corner-lava", x: 72 * scaleX, y: 390 * scaleY, r: 20 * scale, color: "transparent" })
    .addKillZone({ id: "south-east-corner-lava", x: 728 * scaleX, y: 390 * scaleY, r: 20 * scale, color: "transparent" })
    .buildMapDocument();
}
