/**
 * @fileoverview Zentraler Hub für statische Kartenstrukturen.
 */

import type { EffectTrigger, EffectType } from "../effects/types.js";
import type { ISettingsSerialize } from "../engine/types.js";
import type { IPhysics, SHAPE } from "../physics/physics.js";
import type { MapBoundarySettingsCircle, MapBoundarySettingsLine, MapBoundarySettingsRect, SettingsEffect } from "../settings/settings.js";
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
	IMapBoundary<EffectType, EffectTrigger>,
	ISettingsSerialize<MapBoundarySettingsCircle<EffectType, EffectTrigger> | MapBoundarySettingsRect<EffectType, EffectTrigger> | MapBoundarySettingsLine<EffectType, EffectTrigger>> { }
export type StructureMap = {
	[SHAPE.CIRCLE]: StructureCircle & IPhysics<SHAPE.CIRCLE>
	[SHAPE.RECTANGLE]: StructureRectangle & IPhysics<SHAPE.RECTANGLE>
	[SHAPE.LINE]: StructureLine & IPhysics<SHAPE.LINE>
}

export type Structure<T extends SHAPE> = StructureMap[T]

export type MapBoundary<T extends EffectType, K extends EffectTrigger> = MapBoundaryCircle<T, K> | MapBoundaryLine<T, K> | MapBoundaryRect<T, K>
export interface IMapBoundary<T extends EffectType, K extends EffectTrigger> {
	getType(): SHAPE
	getX(): number;
	getY(): number;
	getEffects(): SettingsEffect<T, K>[]
}

export interface MapBoundaryCircle<T extends EffectType, K extends EffectTrigger> extends IMapBoundary<T, K> {
	type: SHAPE.CIRCLE
	r: number;
	color?: string;
}

export interface MapBoundaryLine<T extends EffectType, K extends EffectTrigger> extends IMapBoundary<T, K> {
	type: SHAPE.LINE
	x2: number;
	y2: number;
	color?: string;
}

export interface MapBoundaryRect<T extends EffectType, K extends EffectTrigger> extends IMapBoundary<T, K> {
	type: SHAPE.RECTANGLE
	w: number;
	h: number;
	color?: string;
}
