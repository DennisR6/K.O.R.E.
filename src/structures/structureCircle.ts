import { createRuntimeEffect } from "../effects/runtimeFactory.js";
import { createCollisionEnterEvent, dispatchTriggeredEffects } from "../effects/triggerDispatcher.js";
import { EffectTrigger, type Effect, type FullEffectSettings, type SettingKey, type SettingValue } from "../effects/types.js";
import type { RenderContext } from "../kore/runtime/RenderContext.js"
import type { ISettingsSerialize } from "../kore/runtime/types.js";
import { SHAPE, type IPhysics, type StructureCollisionRole, type Vector2D } from "@coffeemakerstudio/bean"
import { type MapBoundarySettingsCircle } from "../settings/settings.js";
import { type Structure } from "./types.js";
import { deriveStructureId } from "./identity.js";
import type { CollisionCommandBinding } from "@coffeemakerstudio/roast";

/**
 * Repräsentiert ein kreisförmiges, statisches Hindernis auf dem Spielfeld (z.B. einen Pfosten oder Bumper).
 * 
 * Im Gegensatz zu Entities sind Structures meist unbeweglich, nehmen aber voll 
 * am Physik-System teil (Kollisionen).
 * 
 * @implements {IStructure} Basis-Interface für Hindernisse.
 * @implements {IPhysicsCircle} Notwendig für die Kreis-Kreis-Kollisionslogik.
 */
export class StructureCircle implements Structure<SHAPE.CIRCLE>, IPhysics<SHAPE.CIRCLE>, ISettingsSerialize<MapBoundarySettingsCircle> {
	private position: Vector2D
	/** Radius des Kreises. */
	private r: number;
	/** Kennung der Form für das Physik-System. */
	private shape: SHAPE.CIRCLE;
	/** 
	 * Die Masse ist extrem hoch gesetzt (9000), damit das Hindernis 
	 * bei Kollisionen als unbeweglich ("immovable") fungiert. 
	 */
	private mass: number = Infinity;

	private color?: string
	private bounce: number
	private vel: Vector2D
	private isPhysicsEnabled: boolean = true
	private isDrawingEnabled: boolean = true
	private readonly id: string
	private serializeState: boolean

	// @ts-ignore
	// aktuell brauchen wir diese noch nicht.
	// Aber für die Items später dann schon
	private friction: number | undefined
	private collisionEffects: Effect[] = []
	private alwaysEffects: Effect[] = []
	private roundEffects: Effect[] = []
	private collisionRole: StructureCollisionRole | undefined
	private readonly collisionCommands: CollisionCommandBinding[]

	constructor(x: number, y: number, r: number, color: string | undefined, effects: FullEffectSettings[], role?: StructureCollisionRole, id?: string, physicsEnabled?: boolean, drawingEnabled?: boolean, collisionCommands: CollisionCommandBinding[] = []) {
		this.position = { x, y }
		this.r = r
		this.shape = SHAPE.CIRCLE
		this.color = color
		this.bounce = Infinity
		this.vel = { x: 0, y: 0 }
		this.collisionRole = role
		this.id = id ?? deriveStructureId({ type: SHAPE.CIRCLE, x, y, r, color, effects, role });
		this.serializeState = id !== undefined || physicsEnabled !== undefined || drawingEnabled !== undefined;
		this.isPhysicsEnabled = physicsEnabled ?? true;
		this.isDrawingEnabled = drawingEnabled ?? true;
		this.collisionCommands = structuredClone(collisionCommands);
		for (const eff of effects) {
			switch (eff.trigger) {
				case EffectTrigger.Collision: this.collisionEffects.push(createRuntimeEffect(eff)); continue
				case EffectTrigger.Round: this.roundEffects.push(createRuntimeEffect(eff)); continue
				case EffectTrigger.Always: this.alwaysEffects.push(createRuntimeEffect(eff)); continue
				default: console.trace("this is not implemted yet"); continue
			}
		}
		this.toSettings()
	}
	/**
	 * Zeichnet die Struktur. 
	 * Beachte: Hier wird erst die Farbe gesetzt und dann ein Bild darübergelegt.
	*/
	public draw(ctx: RenderContext) {
		if (!this.color || this.color === "transparent" || !this.isDrawingEnabled) return
		ctx.push()
		ctx.setFillColor(this.color)
		const { x, y } = this.getPos()
		ctx.drawCircle(x, y, this.r);
		ctx.pop()
	}

	public tick(_dt: number): void { }


	public setPos(pos: Vector2D): void {
		this.position.x = pos.x
		this.position.y = pos.y
	}
	public getPos(): Vector2D { return { x: this.position.x, y: this.position.y } }

	public setVel(vel: Vector2D): void { this.vel = vel }
	public getVel(): Vector2D { return this.vel }

	public setMass(mass: number): void { this.mass = mass }
	public getMass(): number { return this.mass }

	public setFriction(_friction: number): void { }
	public getFriction(): number { return 0 }

	public getShape(): SHAPE.CIRCLE { return this.shape }
	public getBounds(): Vector2D { return { x: this.r, y: this.r } }

	public setBounceFactor(bounce: number): void { this.bounce = bounce }
	public getBounceFactor(): number { return this.bounce }

	public onCollision({ entity }: { entity: IPhysics<SHAPE> }): void {
		dispatchTriggeredEffects({ effects: this.collisionEffects, event: createCollisionEnterEvent("structure.circle", "entity", "structure.circle", "structure.circle:collision"), apply: effect => effect.apply(entity) })
	}
	public getColor(): string | undefined { return this.color }
	public physicsEnabled(): boolean { return this.isPhysicsEnabled }
	public setPhysicsEnabled(physicsEnabled: boolean): void { this.isPhysicsEnabled = physicsEnabled; this.serializeState = true }
	public drawingEnabled(): boolean { return this.isDrawingEnabled }
	public setDrawingEnabled(drawingEnabled: boolean): void { this.isDrawingEnabled = drawingEnabled; this.serializeState = true }
	public getId(): string { return this.id }
	public setSetting(key: SettingKey, value: SettingValue): void { if (typeof value !== "boolean") return; if (key === "physicsEnabled") this.setPhysicsEnabled(value); else if (key === "drawingEnabled") this.setDrawingEnabled(value); }
	public addSetting(key: SettingKey, value: SettingValue): void { this.setSetting(key, value); }
	public removeSetting(key: SettingKey, value: SettingValue): void { if (typeof value === "boolean") this.setSetting(key, !value); }
	public getCollisionCommands(): readonly CollisionCommandBinding[] { return this.collisionCommands; }
	public setColor(color: string | undefined) { this.color = color }
	public getCollisionRole(): StructureCollisionRole | undefined { return this.collisionRole }
	public setCollisionRole(role: StructureCollisionRole | undefined): void { this.collisionRole = role }
	public toSettings(): MapBoundarySettingsCircle {
		const effects: FullEffectSettings[] = []
		this.alwaysEffects.forEach(eff => effects.push({ trigger: EffectTrigger.Always, triggerValue: [], ...eff.toSettings() }))
		this.roundEffects.forEach(eff => effects.push({ trigger: EffectTrigger.Round, triggerValue: [], ...eff.toSettings() }))
		this.collisionEffects.forEach(eff => effects.push({ trigger: EffectTrigger.Collision, triggerValue: [], ...eff.toSettings() }))
		const out: MapBoundarySettingsCircle = {
			type: this.shape,
			x: this.position.x,
			y: this.position.y,
			r: this.r,
			color: this.color,
			effects,
		}
		if (this.collisionRole !== undefined) out.role = this.collisionRole
		if (this.serializeState) { out.id = this.id; out.physicsEnabled = this.isPhysicsEnabled; out.drawingEnabled = this.isDrawingEnabled; }
		if (this.collisionCommands.length > 0) out.collisionCommands = structuredClone(this.collisionCommands);
		return out
	}
	public getType(): SHAPE.CIRCLE { return this.shape }
	public getX(): number { return this.position.x }
	public getY(): number { return this.position.y }
}
