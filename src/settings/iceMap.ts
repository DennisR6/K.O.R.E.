import { AssetList } from "../assetManager/assets/assetRegistry.js";
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
// const Wall = { type: EffectType.Physics, trigger: EffectTrigger.Always, values: {}, triggerValues: {} }
// const Deadly = { type: EffectType.Damage, trigger: EffectTrigger.Collision, values: { damage: -100 }, triggerValues: {} }
const IceMap: SettingsMap = {
	screenResolution: { x, y },
	background: { type: "image", url: AssetList.SlipstrikeIceMap },
	mapBoundarys: [
		// { type: SHAPE.RECTANGLE, x: 66, y: 90, w: thickness, h: 270, color: debugColorStruct, effects: [Wall] },
		// { type: SHAPE.RECTANGLE, x: 105, y: 55, w: 270, h: thickness, color: debugColorStruct, effects: [Wall] },
		// { type: SHAPE.RECTANGLE, x: 425, y: 55, w: 270, h: thickness, color: debugColorStruct, effects: [Wall] },
		// { type: SHAPE.RECTANGLE, x: 105, y: y - 65, w: 270, h: thickness, color: debugColorStruct, effects: [Wall] },
		// { type: SHAPE.RECTANGLE, x: 425, y: y - 65, w: 270, h: thickness, color: debugColorStruct, effects: [Wall] },
		// { type: SHAPE.RECTANGLE, x: 800 - 66 - thickness, y: 90, w: thickness, h: 270, color: debugColorStruct, effects: [Wall] },
		// { type: SHAPE.RECTANGLE, x: x / 2, y: 450 / 3, w: thickness, h: 450 / 3, color: "blue", effects: [Wall] },
		//
		// { type: SHAPE.CIRCLE, x: 73, y: 58, r: thickness, color: debugColorStruct, effects: [Deadly, Wall] },
		// { type: SHAPE.CIRCLE, x: x - 73, y: 58, r: thickness, color: debugColorStruct, effects: [Deadly, Wall] },
		// { type: SHAPE.CIRCLE, x: x - 73, y: y - 58, r: thickness, color: debugColorStruct, effects: [Deadly, Wall] },
		// { type: SHAPE.CIRCLE, x: 73, y: y - 58, r: thickness, color: debugColorStruct, effects: [Deadly, Wall] },
		// { type: SHAPE.CIRCLE, x: x / 2, y: 44, r: thickness, color: debugColorStruct, effects: [Deadly, Wall] },
		// { type: SHAPE.CIRCLE, x: x / 2, y: y - 44, r: thickness, color: debugColorStruct, effects: [Deadly, Wall] },
		//

		{ type: SHAPE.RECTANGLE, x: 66, y: 90, w: 10, h: 270, color: debugColorStruct, },
		{ type: SHAPE.RECTANGLE, x: 100, y: 50, w: 270, h: 10, color: debugColorStruct },
		{ type: SHAPE.RECTANGLE, x: 425, y: 55, w: 270, h: 10, color: debugColorStruct, },
		{ type: SHAPE.RECTANGLE, x: 100, y: 385, w: 270, h: 10, color: debugColorStruct },
		{ type: SHAPE.RECTANGLE, x: 425, y: 385, w: 270, h: 10, color: debugColorStruct },
		{ type: SHAPE.RECTANGLE, x: 725, y: 90, w: 10, h: 270, color: debugColorStruct },
		{ type: SHAPE.RECTANGLE, x: 400, y: 150, w: 10, h: 150, color: debugColorStruct },
		{ type: 0, x: 60, y: 45, r: 10, color: debugColorStruct },
		{ type: 0, x: 720, y: 50, r: 10, color: debugColorStruct },
		{ type: 0, x: 720, y: 385, r: 10, color: debugColorStruct },
		{ type: 0, x: 60, y: 385, r: 10, color: debugColorStruct },
		{ type: 0, x: 390, y: 35, r: 10, color: debugColorStruct },
		{ type: 0, x: 390, y: 400, r: 10, color: debugColorStruct }
	],
}

export default {
	createPlayerStartPoints,
	IceMap,
}
