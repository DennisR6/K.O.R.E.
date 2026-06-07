import { AssetList } from "../assetManager/assets/assetRegistry.js";
import { EffectTrigger, EffectType } from "../effects/types.js";
import { SHAPE } from "../physics/physics.js";
import type { SettingsMap } from "./settings.js";

const thickness = 2
const [x, y] = [800, 450]
const offset = 30
const CircleRadius = 15
const debugColorStruct = "blue"
const Wall = { type: EffectType.Physics, trigger: EffectTrigger.Collision, values: { damage: 100 }, triggerValues: {} }
const Deadly = { type: EffectType.Damage, trigger: EffectTrigger.Collision, values: { damage: 100 }, triggerValues: {} }
export const BilliardMap: SettingsMap = {
	screenResolution: { x, y },
	mapBoundarys: [
		{ type: SHAPE.RECTANGLE, x: 45, y: 75, w: thickness, h: 300, color: debugColorStruct, effects: [Wall] },
		{ type: SHAPE.RECTANGLE, x: 75, y: 45, w: 300, h: thickness, color: debugColorStruct, effects: [Wall] },
		{ type: SHAPE.RECTANGLE, x: 425, y: 45, w: 300, h: thickness, color: debugColorStruct, effects: [Wall] },
		{ type: SHAPE.RECTANGLE, x: 75, y: 405, w: 300, h: thickness, color: debugColorStruct, effects: [Wall] },
		{ type: SHAPE.RECTANGLE, x: 425, y: 405, w: 300, h: thickness, color: debugColorStruct, effects: [Wall] },
		{ type: SHAPE.RECTANGLE, x: 800 - 45, y: 75, w: thickness, h: 300, color: debugColorStruct, effects: [Wall] },
		{ type: SHAPE.RECTANGLE, x: x / 2, y: y / 3, w: thickness, h: y / 3, color: "black", effects: [Wall] },

		{ type: SHAPE.CIRCLE, x: offset + CircleRadius, y: offset + CircleRadius, r: CircleRadius, color: debugColorStruct, effects: [Deadly] },
		{ type: SHAPE.CIRCLE, x: x / 2, y: offset + 5, r: CircleRadius, color: debugColorStruct, effects: [Deadly] },
		{ type: SHAPE.CIRCLE, x: (x - offset - CircleRadius), y: offset + CircleRadius, r: CircleRadius, color: debugColorStruct, effects: [Deadly] },
		{ type: SHAPE.CIRCLE, x: offset + 10, y: 408, r: CircleRadius, color: debugColorStruct, effects: [Deadly] },
		{ type: SHAPE.CIRCLE, x: x / 2, y: 413, r: CircleRadius, color: debugColorStruct, effects: [Deadly] },
		{ type: SHAPE.CIRCLE, x: 760, y: 408, r: CircleRadius, color: debugColorStruct, effects: [Deadly] },
	],
	background: { type: "image", url: AssetList.billiardGrosserLochJungePNG },
}
