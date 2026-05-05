import type { RenderContext } from "../engine/RenderContext"
import type { IPhysics, IPhysicsCircle, Vector2D } from "../physics/physics"
import { GameLogger } from "../utils/log"
import type { IStructure } from "./structures"

/**
 * Repräsentiert ein kreisförmiges, statisches Hindernis auf dem Spielfeld (z.B. einen Pfosten oder Bumper).
 * 
 * Im Gegensatz zu Entities sind Structures meist unbeweglich, nehmen aber voll 
 * am Physik-System teil (Kollisionen).
 * 
 * @implements {IStructure} Basis-Interface für Hindernisse.
 * @implements {IPhysicsCircle} Notwendig für die Kreis-Kreis-Kollisionslogik.
 */
export class StructureCircle implements IStructure, IPhysicsCircle {
	/** X-Koordinate des Mittelpunkts. */
	private x: number;
	/** Y-Koordinate des Mittelpunkts. */
	private y: number;
	/** Radius des Kreises. */
	private r: number;
	/** Kennung der Form für das Physik-System. */
	private shape: "circle";
	/** 
	 * Die Masse ist extrem hoch gesetzt (9000), damit das Hindernis 
	 * bei Kollisionen als unbeweglich ("immovable") fungiert. 
	 */
	private mass: number = 9000;

	private color: string
	private bounce: number
	private vel: Vector2D

	// @ts-ignore
	// aktuell brauchen wir diese noch nicht.
	// Aber für die Items später dann schon
	private friction: number | undefined


	constructor(x: number, y: number, r: number, color: string) {
		this.shape = "circle"
		this.x = x
		this.y = y
		this.r = r
		this.color = color || "green"
		this.bounce = 1
		this.vel = { x: 0, y: 0 }
	}
	/**
	 * Zeichnet die Struktur. 
	 * Beachte: Hier wird erst die Farbe gesetzt und dann ein Bild (eis.png) darübergelegt.
	*/
	public draw(ctx: RenderContext) {
		ctx.setFillColor(this.color)
		ctx.drawCircle(this.x, this.y, this.r * 2)
		ctx.drawImage("/eis.png", this.x - this.r * 2, this.y - this.r * 2, this.r * 4, this.r * 4)
	}

	public tick(_dt: number): void { }

	public getBounceFactor(): number {
		return this.bounce
	}

	public getBounds(): { radius: number } {
		return { radius: this.r }
	}

	public getPos(): Vector2D {
		return { x: this.x, y: this.y }
	}

	public getVel(): Vector2D {
		return this.vel
	}

	public setVel(vel: Vector2D): void {
		this.vel = vel
	}

	public setMass(mass: number): void {
		this.mass = mass
	}

	public getMass(): number {
		return this.mass
	}

	public setPos(pos: Vector2D): void {
		this.x = pos.x
		this.y = pos.y
	}

	public onCollision({ entity }: { entity: IPhysics }): void {
		GameLogger.debug("Collision with:" + entity.getShape())
	}

	public getFriction(): number {
		return 0
	}

	public setFriction(_friction: number): void { }

	public getShape(): "circle" { return this.shape }
}

