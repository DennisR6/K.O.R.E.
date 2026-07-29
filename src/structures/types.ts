/**
 * @fileoverview Zentraler Hub für statische Kartenstrukturen.
 */

import type { IPhysics, SHAPE } from "../physics/physics.js";
import type { ISettingsSerialize } from "../engine/types.js";
import type { MapBoundarySettings } from "../settings/settings.js";
import { StructureCircle } from "./structureCircle.js";
import { StructureLine } from "./structureLine.js";
import { StructureRectangle } from "./structureRectangle.js";
import type { ITicker } from "./types.js";
import type { IDrawer } from "./types.js";
export type { IDrawer, ITicker } from "../engine/RenderContext.js";
export { StructureCircle } from "./structureCircle.js";
export { StructureLine } from "./structureLine.js";
export { StructureRectangle } from "./structureRectangle.js";

export interface IStructure extends
	IDrawer,
	ITicker,
	ISettingsSerialize<MapBoundarySettings>
// ,IMapBoundary<EffectType, EffectTrigger>
// ,ISettingsSerialize<MapBoundarySettingsCircle<EffectType, EffectTrigger> | MapBoundarySettingsRect<EffectType, EffectTrigger> | MapBoundarySettingsLine<EffectType, EffectTrigger>> 
{ }
export type StructureMap = {
	[SHAPE.CIRCLE]: StructureCircle & IPhysics<SHAPE.CIRCLE>
	[SHAPE.RECTANGLE]: StructureRectangle & IPhysics<SHAPE.RECTANGLE>
	[SHAPE.LINE]: StructureLine & IPhysics<SHAPE.LINE>
}

export type Structure<T extends SHAPE> = StructureMap[T]

export type MapBoundary = MapBoundaryCircle | MapBoundaryLine | MapBoundaryRect
export interface IMapBoundary {
	getType(): SHAPE
	getX(): number;
	getY(): number;
	// getEffects(): SettingsEffect<T, K>[]
}

export interface MapBoundaryCircle extends IMapBoundary {
	type: SHAPE.CIRCLE
	r: number;
	color?: string;
}

export interface MapBoundaryLine extends IMapBoundary {
	type: SHAPE.LINE
	x2: number;
	y2: number;
	color?: string;
}

export interface MapBoundaryRect extends IMapBoundary {
	type: SHAPE.RECTANGLE
	w: number;
	h: number;
	color?: string;
}
