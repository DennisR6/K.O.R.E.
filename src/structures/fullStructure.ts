import type { EffectSettings } from "../effects/types.js";
import type { RenderContext } from "../kore/runtime/RenderContext.js";
import { SHAPE, type IdefaultPhysics, type IPhysics, type RoleAwarePhysics, type StructureCollisionRole, type Vector2D } from "@coffeemakerstudio/bean";
import type { MapBoundarySettings } from "../settings/settings.js";
import { StructureCircle, StructureLine, StructureRectangle } from "./types.js";
import type { IStructure } from "./types.js";
import type { SettingKey, SettingValue } from "../effects/types.js";
import type { CollisionCommandBinding } from "@coffeemakerstudio/roast";

export class FullStructure implements IStructure, IdefaultPhysics {
	str: IStructure & RoleAwarePhysics
	constructor(str: MapBoundarySettings) {
		if (str.id === undefined) throw new Error("Runtime structures require an explicit canonical ID");
		switch (str.type) {
			case SHAPE.CIRCLE: this.str = new StructureCircle(str.x, str.y, str.r, str.color, str.effects, str.role, str.id, str.physicsEnabled, str.drawingEnabled, str.collisionCommands); break;
			case SHAPE.RECTANGLE: this.str = new StructureRectangle(str.x, str.y, str.w, str.h, str.color, str.effects, str.role, str.id, str.physicsEnabled, str.drawingEnabled, str.collisionCommands); break;
			case SHAPE.LINE: this.str = new StructureLine(str.x, str.y, str.x2, str.y2, str.color ?? "green", str.effects, str.id, str.physicsEnabled, str.drawingEnabled, str.collisionCommands); break;
		}
	}

	public tick(deltatime: number, globalfriction: number): void { this.str.tick(deltatime, globalfriction) }
	public getShape(): SHAPE { return this.str.getShape() }
	public draw(ctx: RenderContext): void { this.str.draw(ctx) }
	public getId(): string { return this.str.getId() }
	public drawingEnabled(): boolean { return this.str.drawingEnabled() }
	public setDrawingEnabled(drawingEnabled: boolean): void { this.str.setDrawingEnabled(drawingEnabled) }
	public setSetting(key: SettingKey, value: SettingValue): void { this.str.setSetting(key, value) }
	public addSetting(key: SettingKey, value: SettingValue): void { this.str.addSetting(key, value) }
	public removeSetting(key: SettingKey, value: SettingValue): void { this.str.removeSetting(key, value) }
	public getCollisionCommands(): readonly CollisionCommandBinding[] { return this.str.getCollisionCommands(); }
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
	public getEffects(): EffectSettings[] { return [] }
	public toSettings(): MapBoundarySettings { return this.str.toSettings() }
	public getCollisionRole(): StructureCollisionRole | undefined { return this.str.getCollisionRole() }
	public isPhysicsObj(): this is IStructure & IPhysics<SHAPE> { return typeof (this as any).str.getShape() === 'function' }
}
