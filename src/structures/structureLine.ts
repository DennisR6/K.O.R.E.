import type { RenderContext } from "../engine/RenderContext.js"
import type { IPhysics, IPhysicsRectangle, Vector2D } from "../physics/physics.js"
import { GameLogger } from "../utils/log.js"

/**
 * Repräsentiert ein statisches, rechteckiges Hindernis (z.B. eine Bande oder Mauer).
 * 
 * Auch wenn der Name "Line" vermutet lässt, definiert dieses Objekt physikalisch
 * ein Rechteck über Startpunkt (x, y) sowie Breite und Höhe (x2, y2).
 * @implements {IStructure} Basis-Interface für Hindernisse.
 * @implements {IPhysicsRectangle} Notwendig für die Kreis-Rechteck-Kollisionslogik.
 */
export class StructureLine implements IPhysicsRectangle {
	/** X-Koordinate der oberen linken Ecke. */
	private x: number;
	/** Y-Koordinate der oberen linken Ecke. */
	private y: number;
	/** Breite des Rechtecks (Pixel/Welt-Einheiten). */
	private x2: number;
	/** Höhe des Rechtecks (Pixel/Welt-Einheiten). */
	private y2: number;

	/** Kennung der Form für das Physik-System. */
	private shape: "rectangle";
	/** Extrem hohe Masse (Infinity), damit Wände niemals weggeschoben werden können. */
	private mass: number = Infinity;
	/** Rückprall-Koeffizient (0 = kein Abprallen, die Kugel "klebt" fast an der Wand). */

	private bounce: number;
	private color: string | undefined
	private vel: Vector2D
	private isPhysicsEnabled: boolean = true;

	// @ts-ignore
	// aktuell brauchen wir diese noch nicht.
	// Aber für die Items später dann schon
	private friction: number | undefined

	/**
		 * @param x - Start X (Top-Left).
		 * @param y - Start Y (Top-Left).
		 * @param x2 - Breite des Hindernisses.
		 * @param y2 - Höhe des Hindernisses.
		 * @param color - Farbe der Wand.
		 */
	constructor(x: number, y: number, x2: number, y2: number, color: string) {
		this.x = x
		this.x2 = x2
		this.y = y
		this.y2 = y2
		this.color = color || "green"
		this.shape = "rectangle"
		this.vel = { x: 0, y: 0 }
		this.bounce = Infinity
	}

	public draw(ctx: RenderContext) {
		if (!this.color) return
		ctx.setFillColor(this.color)
		ctx.setStrokeColor(this.color)
		ctx.drawRect(this.x, this.y, this.x2, this.y2)
	}

	public setBounceFactor(bounce: number): void { this.bounce = bounce }
	public getBounceFactor(): number { return this.bounce }

	/**
		 * Gibt die Dimensionen für die Kollisionsabfrage zurück.
		 * @returns {width, height} Breite und Höhe des Objekts.
		 */
	public getBounds(): Vector2D { return { x: this.x2, y: this.y2 } }

	/**
		 * Gibt den Ankerpunkt zurück. 
		 * Bei Rechtecken ist dies im Gegensatz zu Kreisen meist die obere linke Ecke.
		 */
	public getPos(): Vector2D { return { x: this.x, y: this.y } }

	public getVel(): Vector2D { return this.vel }

	public onCollision({ entity }: { entity: IPhysics }): void {
		GameLogger.info(`Collision: ${this.getShape()} + ${entity.getShape()}`)
	}

	public setVel(vel: Vector2D): void { this.vel = vel }

	public setMass(mass: number): void { this.mass = mass }

	public getMass(): number { return this.mass }

	public setPos(pos: Vector2D): void {
		this.x = pos.x
		this.y = pos.y
	}

	public setFriction(friction: number): void { this.friction = friction }
	public getFriction(): number { return this.friction ?? 1 }

	/**
		 * Logik-Update für Animationen oder Zeit-Effekte.
		 * @param _deltatime - Vergangene Zeit.
		 * @param _globalfriction - Globale Reibung (wird von statischen Wänden ignoriert).
		 */
	public tick(_deltatime: number, _globalfriction: number): void { }

	/** @returns Immer "rectangle" für den Collision-Dispatcher. */
	public getShape(): "rectangle" { return this.shape }
	public physicsEnabled(): boolean { return this.isPhysicsEnabled }
	public setPhysicsEnabled(physicsEnabled: boolean): void { this.isPhysicsEnabled = physicsEnabled }
	public setColor(color: string | undefined) { this.color = color }
}
