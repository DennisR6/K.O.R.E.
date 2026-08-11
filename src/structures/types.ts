/**
 * @fileoverview Zentraler Hub für statische Kartenstrukturen.
 */

import type { IPhysics, SHAPE } from "@coffeemakerstudio/bean";
import type { ISettingsSerialize } from "../kore/runtime/types.js";
import type { MapBoundarySettings } from "../settings/settings.js";
import type { SettingKey, SettingValue } from "../effects/types.js";
import type { CollisionCommandBinding } from "@coffeemakerstudio/roast";
import { StructureCircle } from "./structureCircle.js";
import { StructureLine } from "./structureLine.js";
import { StructureRectangle } from "./structureRectangle.js";
import type { ITicker } from "./types.js";
import type { IDrawer } from "./types.js";
export type { IDrawer, ITicker } from "../kore/runtime/RenderContext.js";
export { StructureCircle } from "./structureCircle.js";
export { StructureLine } from "./structureLine.js";
export { StructureRectangle } from "./structureRectangle.js";

export interface IStructure extends
	IDrawer,
	ITicker,
	ISettingsSerialize<MapBoundarySettings>
// ,IMapBoundary<EffectType, EffectTrigger>
// ,ISettingsSerialize<MapBoundarySettingsCircle<EffectType, EffectTrigger> | MapBoundarySettingsRect<EffectType, EffectTrigger> | MapBoundarySettingsLine<EffectType, EffectTrigger>> 
{
	getId(): string;
	getPos(): { x: number; y: number };
	getVel(): { x: number; y: number };
	getBounds(): { x: number; y: number };
	getMass(): number;
	getShape(): SHAPE;
	getFriction(): number | undefined;
	getBounceFactor(): number;
	onCollision({ entity }: { entity: IPhysics<SHAPE> }): void;
	setPos(pos: { x: number; y: number }): void;
	setVel(vel: { x: number; y: number }): void;
	setMass(mass: number): void;
	setFriction(friction: number): void;
	setBounceFactor(bounce: number): void;
	physicsEnabled(): boolean;
	setPhysicsEnabled(physicsEnabled: boolean): void;
	drawingEnabled(): boolean;
	setDrawingEnabled(drawingEnabled: boolean): void;
	setSetting(key: SettingKey, value: SettingValue): void;
	addSetting(key: SettingKey, value: SettingValue): void;
	removeSetting(key: SettingKey, value: SettingValue): void;
	getCollisionCommands(): readonly CollisionCommandBinding[];
}
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
