import { AssetList } from "../assetManager/assets/assetRegistry.js";
import { EffectTrigger, EffectType } from "../effects/types.js";
import { SHAPE } from "../physics/physics.js";
import type { SettingsMap } from "./settings.js";

const debug = true
const [x, y] = [800, 450]
const thickness = 10
const debugColorStruct = debug ? "blue" : undefined

const Wall = { type: EffectType.Physics, trigger: EffectTrigger.Collision, values: { damage: 100 }, triggerValues: {} }
const Deadly = { type: EffectType.Damage, trigger: EffectTrigger.Collision, values: { damage: 100 }, triggerValues: {} }
export const IceMap: SettingsMap = {
	screenResolution: { x, y },
	background: { type: "image", url: AssetList.SlipstrikeIceMap },
	mapBoundarys: [
		// { type: SHAPE.RECTANGLE, x: 66, y: 90, w: thickness, h: 270, color: debugColorStruct, effects: [Wall] },
		// { type: SHAPE.RECTANGLE, x: 105, y: 55, w: 270, h: thickness, color: debugColorStruct, effects: [Wall] },
		// { type: SHAPE.RECTANGLE, x: 425, y: 55, w: 270, h: thickness, color: debugColorStruct, effects: [Wall] },
		// { type: SHAPE.RECTANGLE, x: 105, y: y - 65, w: 270, h: thickness, color: debugColorStruct, effects: [Wall] },
		// { type: SHAPE.RECTANGLE, x: 425, y: y - 65, w: 270, h: thickness, color: debugColorStruct, effects: [Wall] },
		// { type: SHAPE.RECTANGLE, x: 800 - 66 - thickness, y: 90, w: thickness, h: 270, color: debugColorStruct, effects: [Wall] },
		{ type: SHAPE.RECTANGLE, x: x / 2, y: 450 / 3, w: thickness, h: 450 / 3, color: "blue", effects: [Wall, Deadly] },

		{ type: SHAPE.CIRCLE, x: 73, y: 58, r: thickness, color: debugColorStruct, effects: [Deadly] },
		{ type: SHAPE.CIRCLE, x: x - 73, y: 58, r: thickness, color: debugColorStruct, effects: [Deadly] },
		{ type: SHAPE.CIRCLE, x: x - 73, y: y - 58, r: thickness, color: debugColorStruct, effects: [Deadly] },
		{ type: SHAPE.CIRCLE, x: 73, y: y - 58, r: thickness, color: debugColorStruct, effects: [Deadly] },
		{ type: SHAPE.CIRCLE, x: x / 2, y: 44, r: thickness, color: debugColorStruct, effects: [Deadly] },
		{ type: SHAPE.CIRCLE, x: x / 2, y: y - 44, r: thickness, color: debugColorStruct, effects: [Deadly] },
	],
}
