import type { EffectTrigger, EffectType } from "../effects/types.js";
import type { RenderContext } from "../engine/RenderContext.js";
import type { ISettingsSerialize } from "../engine/types.js";
import { SHAPE, type IdefaultPhysics, type IPhysics, type Vector2D } from "../physics/physics.js";
import type { MapBoundarySettings, MapBoundarySettingsCircle, MapBoundarySettingsLine, MapBoundarySettingsRect, SettingsEffect } from "../settings/settings.js";
import { StructureCircle, StructureRectangle } from "./types.js";
import type { IStructure } from "./types.js";

export class FullStructure implements
	IStructure,
	ISettingsSerialize<MapBoundarySettingsCircle<EffectType, EffectTrigger> | MapBoundarySettingsRect<EffectType, EffectTrigger> | MapBoundarySettingsLine<EffectType, EffectTrigger>>,
	IdefaultPhysics {
	str: IStructure & IPhysics<SHAPE>
	constructor(str: MapBoundarySettings<EffectType, EffectTrigger>) {
		switch (str.type) {
			case SHAPE.CIRCLE: this.str = new StructureCircle(str.x, str.y, str.r, str.color, str.effects); break;
			case SHAPE.RECTANGLE: this.str = new StructureRectangle(str.x, str.y, str.w, str.h, str.color, str.effects); break;
			default: this.str = new StructureRectangle(str.x, str.y, str.x + 20, str.y + 20, str.color, str.effects); console.log(`STRUCTURE ${SHAPE.LINE} not implemented`);
		}
	}

	public tick(deltatime: number, globalfriction: number): void { this.str.tick(deltatime, globalfriction) }
	public getShape(): SHAPE { return this.str.getShape() }
	public draw(ctx: RenderContext): void { this.str.draw(ctx) }
	public getFriction(): number | undefined { return this.str.getFriction() }
	public getPos(): Vector2D { return this.str.getPos() }
	public getVel(): Vector2D { return this.str.getVel() }
	public getBounceFactor(): number { return this.str.getBounceFactor() }
	public getBounds(): Vector2D { return this.str.getBounds() }
	public getMass(): number { return this.str.getMass() }
	public onCollision({ entity }: { entity: IPhysics<SHAPE>; }): void { this.str.onCollision({ entity }) }
	public physicsEnabled(): boolean { return this.str.physicsEnabled() }
	public setBounceFactor(bounce: number): void { this.str.setBounceFactor(bounce) }
	public setFriction(friction: number): void { this.str.setFriction(friction) }
	public setMass(mass: number): void { this.str.setMass(mass) }
	public setPhysicsEnabled(physicsEnabled: boolean): void { this.str.setPhysicsEnabled(physicsEnabled) }
	public setPos(pos: Vector2D): void { this.str.setPos(pos) }
	public setVel(vel: Vector2D): void { this.str.setVel(vel) }
	public toSettings(): MapBoundarySettingsCircle<EffectType, EffectTrigger> | MapBoundarySettingsRect<EffectType, EffectTrigger> | MapBoundarySettingsLine<EffectType, EffectTrigger> { return this.str.toSettings() }
	public getType(): SHAPE { return this.str.getType() }
	public getX(): number { return this.str.getX() }
	public getY(): number { return this.str.getY() }
	public getEffects(): SettingsEffect<EffectType, EffectTrigger>[] { return this.str.getEffects() }
	public isPhysicsObj(): this is IStructure & IPhysics<SHAPE> { return typeof (this as any).str.getShape() === 'function' }
}
