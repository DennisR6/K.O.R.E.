import { EffectTrigger, EffectType, type Effect } from "../effects/types.js";
import type { RenderContext } from "../engine/RenderContext.js"
import type { ISettingsSerialize } from "../engine/types.js";
import { getShapeName, SHAPE, type IPhysics, type Vector2D } from "../physics/physics.js"
import type { MapBoundarySettingsCircle, SettingsEffect } from "../settings/settings.js";
import { type Structure } from "./types.js";

/**
 * Repräsentiert ein kreisförmiges, statisches Hindernis auf dem Spielfeld (z.B. einen Pfosten oder Bumper).
 * 
 * Im Gegensatz zu Entities sind Structures meist unbeweglich, nehmen aber voll 
 * am Physik-System teil (Kollisionen).
 * 
 * @implements {IStructure} Basis-Interface für Hindernisse.
 * @implements {IPhysicsCircle} Notwendig für die Kreis-Kreis-Kollisionslogik.
 */
export class StructureCircle implements Structure<SHAPE.CIRCLE>, IPhysics<SHAPE.CIRCLE>, ISettingsSerialize<MapBoundarySettingsCircle<EffectType, EffectTrigger>> {
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

	// @ts-ignore
	// aktuell brauchen wir diese noch nicht.
	// Aber für die Items später dann schon
	private friction: number | undefined
	private effects: Effect[]
	constructor(x: number, y: number, r: number, color?: string, effects: SettingsEffect<EffectType, EffectTrigger>[] = []) {
		this.position = { x, y }
		this.r = r
		this.shape = SHAPE.CIRCLE
		this.color = color
		this.bounce = Infinity
		this.vel = { x: 0, y: 0 }
		this.effects = []
		console.log(effects)
		for (const effect of effects) {
			switch (effect.type) {
				case EffectType.Damage:
					console.log(effect)
					break
				default: console.log(`Effect not implemented in ${getShapeName(this.shape)}`, effect)
			}
		}
	}
	/**
	 * Zeichnet die Struktur. 
	 * Beachte: Hier wird erst die Farbe gesetzt und dann ein Bild darübergelegt.
	*/
	public draw(ctx: RenderContext) {
		if (!this.color) return
		ctx.push()
		ctx.setFillColor(this.color)
		const { x, y } = this.getPos()
		ctx.drawCircle(x + this.r, y + this.r, this.r * 2);
		ctx.pop()
	}

	public tick(_dt: number): void { }


	public setPos(pos: Vector2D): void {
		if (
			(this.position.x > pos.x * 1.1 || this.position.x < pos.x * 0.9) ||
			(this.position.y > pos.y * 1.1 || this.position.y < pos.y * 0.9)
		) { console.error("STRUCTURE: Position weicht massiv ab!"); }

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
		console.info(`Collision: ${getShapeName(this.getShape())} + ${getShapeName(entity.getShape())}`)
		this.effects.forEach(effect => console.log("Effect", effect))
	}
	public getColor(): string | undefined { return this.color }
	public physicsEnabled(): boolean { return this.isPhysicsEnabled }
	public setPhysicsEnabled(physicsEnabled: boolean): void { this.isPhysicsEnabled = physicsEnabled }
	public setColor(color: string | undefined) { this.color = color }
	public applyEffects(): void {
		for (const eff of this.effects) { eff; }
	}
	public toSettings(): MapBoundarySettingsCircle<EffectType, EffectTrigger> {
		return { type: this.shape, x: this.position.x, y: this.position.y, r: this.r, color: this.color, effects: this.effects }
	}

	public getEffects(): SettingsEffect<EffectType, EffectTrigger>[] { return this.effects }
	public getType(): SHAPE.CIRCLE { return this.shape }
	public getX(): number { return this.position.x }
	public getY(): number { return this.position.y }
}

