import { AssetList } from "../assetManager/assets/assetRegistry.js";
import { EffectMove } from "../effects/movement.js";
import { EffectPhysics } from "../effects/physics.js";
import { EffectTrigger, type FullEffectSettings } from "../effects/types.js";
import { createCollisionCommandBinding } from "../engine/sdk/collisionCommand.js";
import { createEngineEffectComposition } from "../engine/sdk/composition.js";
import { PARTICIPATION_SET_DRAWING_EFFECT_ID, PARTICIPATION_SET_PHYSICS_EFFECT_ID } from "../engine/sdk/participationCapability.js";
import { SHAPE } from "../physics/physics.js";
import { arrangeInGrid } from "./gridArrangement.js";
import type { SettingsMap } from "./settings.js";
import type { PlayerSettings } from "../entity/types.js";

const debug = true
const [x, y] = [800, 450]
const debugColorStruct = debug ? "blue" : undefined
function createPlayerStartPoints(team: number, players: PlayerSettings[]) {
	players.forEach(player => player.size = 12)
	const teamNr = [{ x: 120, y: 150, w: 200, h: 450 - 150 }, { x: 800 - (120 * 2), y: 120, w: 200, h: 450 - 100 }]
	arrangeInGrid(players, teamNr[team], 46)
}
const friction = { friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 }
const defaultEffects: FullEffectSettings[] = [{ trigger: EffectTrigger.Always, triggerValue: [], ...new EffectMove({ typeValue: { deltaTime: 10, x: 0, y: 0 } }).toSettings() }, { trigger: EffectTrigger.Always, triggerValue: [], ...new EffectPhysics({ typeValue: { ...friction } }).toSettings() }]
const deadly = createCollisionCommandBinding(createEngineEffectComposition([
	{ schemaVersion: 1, type: PARTICIPATION_SET_PHYSICS_EFFECT_ID, typeValue: { enabled: false } },
	{ schemaVersion: 1, type: PARTICIPATION_SET_DRAWING_EFFECT_ID, typeValue: { enabled: false } },
]));
const IceMap: SettingsMap = {
	schemaVersion: 1, screenResolution: { x, y }, worldSize: { x, y }, background: { type: "image", url: AssetList.slipStirkeMapIceJPG }, drift: 0, mapBoundarys: [
		{ id: "ice.wall.left", type: SHAPE.RECTANGLE, x: 66, y: 90, w: 10, h: 270, color: debugColorStruct, effects: [...defaultEffects] }, { id: "ice.wall.top-left", type: SHAPE.RECTANGLE, x: 100, y: 50, w: 270, h: 10, color: debugColorStruct, effects: [...defaultEffects] }, { id: "ice.wall.top-right", type: SHAPE.RECTANGLE, x: 425, y: 55, w: 270, h: 10, color: debugColorStruct, effects: [...defaultEffects] }, { id: "ice.wall.bottom-left", type: SHAPE.RECTANGLE, x: 100, y: 385, w: 270, h: 10, color: debugColorStruct, effects: [...defaultEffects] }, { id: "ice.wall.bottom-right", type: SHAPE.RECTANGLE, x: 425, y: 385, w: 270, h: 10, color: debugColorStruct, effects: [...defaultEffects] }, { id: "ice.wall.right", type: SHAPE.RECTANGLE, x: 725, y: 90, w: 10, h: 270, color: debugColorStruct, effects: [...defaultEffects] }, { id: "ice.wall.center", type: SHAPE.RECTANGLE, x: 400, y: 150, w: 10, h: 150, color: debugColorStruct, effects: [...defaultEffects] },
		{ id: "ice.hazard.top-left", type: SHAPE.CIRCLE, x: 60, y: 45, r: 10, color: debugColorStruct, effects: defaultEffects, collisionCommands: [deadly] }, { id: "ice.hazard.top-right", type: SHAPE.CIRCLE, x: 720, y: 50, r: 10, color: debugColorStruct, effects: defaultEffects, collisionCommands: [deadly] }, { id: "ice.hazard.bottom-right", type: SHAPE.CIRCLE, x: 720, y: 385, r: 10, color: debugColorStruct, effects: defaultEffects, collisionCommands: [deadly] }, { id: "ice.hazard.bottom-left", type: SHAPE.CIRCLE, x: 60, y: 385, r: 10, color: debugColorStruct, effects: defaultEffects, collisionCommands: [deadly] }, { id: "ice.hazard.center-top", type: SHAPE.CIRCLE, x: 390, y: 35, r: 10, color: debugColorStruct, effects: defaultEffects, collisionCommands: [deadly] }, { id: "ice.hazard.center-bottom", type: SHAPE.CIRCLE, x: 390, y: 400, r: 10, color: debugColorStruct, effects: defaultEffects, collisionCommands: [deadly] }
	]
}
export default { createPlayerStartPoints, IceMap }
