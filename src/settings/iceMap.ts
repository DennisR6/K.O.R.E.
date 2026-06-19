import { AssetList } from "../assetManager/assets/assetRegistry.js";
import { EffectDamage } from "../effects/damage.js";
import { EffectMove } from "../effects/movement.js";
import { EffectPhysics } from "../effects/physics.js";
import { EffectTrigger, type FullEffectSettings } from "../effects/types.js";
import { SHAPE } from "../physics/physics.js";
import { arrangeInGrid, type SettingsEntity, type SettingsMap } from "./settings.js";

const debug = true
const [x, y] = [800, 450]
// const thickness = 10
const debugColorStruct = debug ? "blue" : undefined



function createPlayerStartPoints(team: number, players: SettingsEntity[]) {
	players.forEach(player => player.size = 12)
	const teamNr = [
		{ x: 120, y: 120, w: 200, h: 450 - 100 },
		{ x: 800 - (120 * 2), y: 120, w: 200, h: 450 - 100 }
	]
	arrangeInGrid(players, teamNr[team], 46)
}
const friction = { friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 }
const defaultEffects: FullEffectSettings[] = [
	{
		trigger: EffectTrigger.Always, triggerValue: [],
		...new EffectMove({ typeValue: { deltaTime: 10, x: 0, y: 0 } }).toSettings(),
	},
	{
		trigger: EffectTrigger.Always, triggerValue: [],
		...new EffectPhysics({ typeValue: { ...friction } }).toSettings()
	},
]
const deadly = {
	trigger: EffectTrigger.Collision, triggerValue: []
	, ...new EffectDamage({ typeValue: { damage: 100 } }).toSettings()
}

const IceMap: SettingsMap = {
	screenResolution: { x, y },
	background: { type: "image", url: AssetList.slipStirkeMapIceJPG },
	mapBoundarys: [
		{ type: SHAPE.RECTANGLE, x: 66, y: 90, w: 10, h: 270, color: debugColorStruct, effects: [...defaultEffects] },
		{ type: SHAPE.RECTANGLE, x: 100, y: 50, w: 270, h: 10, color: debugColorStruct, effects: [...defaultEffects] },
		{ type: SHAPE.RECTANGLE, x: 425, y: 55, w: 270, h: 10, color: debugColorStruct, effects: [...defaultEffects] },
		{ type: SHAPE.RECTANGLE, x: 100, y: 385, w: 270, h: 10, color: debugColorStruct, effects: [...defaultEffects] },
		{ type: SHAPE.RECTANGLE, x: 425, y: 385, w: 270, h: 10, color: debugColorStruct, effects: [...defaultEffects] },
		{ type: SHAPE.RECTANGLE, x: 725, y: 90, w: 10, h: 270, color: debugColorStruct, effects: [...defaultEffects] },
		{ type: SHAPE.RECTANGLE, x: 400, y: 150, w: 10, h: 150, color: debugColorStruct, effects: [...defaultEffects] },
		{ type: SHAPE.CIRCLE, x: 60, y: 45, r: 10, color: debugColorStruct, effects: [...defaultEffects, deadly] },
		{ type: SHAPE.CIRCLE, x: 720, y: 50, r: 10, color: debugColorStruct, effects: [...defaultEffects, deadly] },
		{ type: SHAPE.CIRCLE, x: 720, y: 385, r: 10, color: debugColorStruct, effects: [...defaultEffects, deadly] },
		{ type: SHAPE.CIRCLE, x: 60, y: 385, r: 10, color: debugColorStruct, effects: [...defaultEffects, deadly] },
		{ type: SHAPE.CIRCLE, x: 390, y: 35, r: 10, color: debugColorStruct, effects: [...defaultEffects, deadly] },
		{ type: SHAPE.CIRCLE, x: 390, y: 400, r: 10, color: debugColorStruct, effects: [...defaultEffects, deadly] }
	],
}

export default {
	createPlayerStartPoints,
	IceMap,
}
