import type { RenderContext } from "../engine/RenderContext.js"
import type { IPhysics, IPhysicsCircle, Vector2D } from "../physics/physics.js"
import { GameLogger } from "../utils/log.js"
import type { IStructure } from "./structures.js"

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
	private position: Vector2D
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
		this.position = { x, y }
		this.r = r
		this.shape = "circle"
		this.color = color || "green"
		this.bounce = Infinity
		this.vel = { x: 0, y: 0 }
	}
	/**
	 * Zeichnet die Struktur. 
	 * Beachte: Hier wird erst die Farbe gesetzt und dann ein Bild darübergelegt.
	*/
	public draw(_ctx: RenderContext) {
		// ctx.push()
		// // ctx.drawRect(this.x - this.r, this.y - this.r, this.r * 2, this.r * 2)
		// ctx.setFillColor(this.color)
		// const { x, y } = this.getPos()
		// ctx.drawCircle(x + this.r, y + this.r, this.r * 2);
		// ctx.pop()
	}

	public tick(_dt: number): void { }


	public setPos(pos: Vector2D): void {
		if (
			(this.position.x > pos.x * 1.1 || this.position.x < pos.x * 0.9) ||
			(this.position.y > pos.y * 1.1 || this.position.y < pos.y * 0.9)
		)
			GameLogger.error("STRUCTURE: Position weicht massiv ab!");

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

	public getShape(): "circle" { return this.shape }
	public getBounds(): Vector2D { return { x: this.r, y: this.r } }
	public setBounceFactor(bounce: number): void { this.bounce = bounce }
	public getBounceFactor(): number { return this.bounce }

	public onCollision({ entity }: { entity: IPhysics }): void {
		GameLogger.debug("Collision with:" + entity.getShape())
	}
	getColor(): string { return this.color }
}

