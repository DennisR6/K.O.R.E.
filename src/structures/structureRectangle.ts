import type { RenderContext } from "../engine/RenderContext.js"
import type { IPhysics, IPhysicsRectangle, Vector2D } from "../physics/physics.js"
import { GameLogger } from "../utils/log.js"
import type { IStructure } from "./types.js";

/**
 * Repräsentiert ein massives, rechteckiges Hindernis (Block).
 * 
 * Diese Klasse ist semantisch sauberer als `StructureLine`, da sie explizit 
 * mit Breite (w) und Höhe (h) arbeitet. Sie ist ideal für größere Blöcke 
 * oder Gebäude-ähnliche Strukturen auf der Map.
 * 
 * @implements {IStructure} Basis-Interface für Hindernisse.
 * @implements {IPhysicsRectangle} Notwendig für die Kreis-Rechteck-Kollisionslogik.
 */
export class StructureRectangle implements IStructure, IPhysicsRectangle {
	/** X-Koordinate der oberen linken Ecke. */
	private x: number;
	/** Y-Koordinate der oberen linken Ecke. */
	private y: number;
	/** Breite (Width) des Rechtecks. */
	private w: number;
	/** Höhe (Height) des Rechtecks. */
	private h: number;

	/** Kennung der Form für das Physik-System. */
	private shape: "rectangle";
	/** Extrem hohe Masse (Infinity), damit das Objekt bei Kollisionen unbeweglich bleibt. */
	private mass: number = Infinity;
	/** Bestimmt das Abprall-Verhalten (Standard 0: absorbiert Energie). */
	private bounce: number;

	private color?: string
	private vel: Vector2D
	private isPhysicsEnabled: boolean = true

	// aktuell brauchen wir diese noch nicht.
	// Aber für die Items später dann schon
	private friction: number | undefined

	/**
	 * @param x - Start X (Top-Left).
	 * @param y - Start Y (Top-Left).
	 * @param w - Breite des Blocks.
	 * @param h - Höhe des Blocks.
	 * @param color - Füllfarbe des Rechtecks.
	 */
	constructor(x: number, y: number, w: number, h: number, color?: string) {
		this.x = x
		this.y = y
		this.w = w
		this.h = h
		this.color = color
		this.shape = "rectangle"
		this.vel = { x: 0, y: 0 }
		this.bounce = Infinity
	}

	/**
		 * Zeichnet das Rechteck basierend auf den Dimensionen w und h.
		 */
	public draw(ctx: RenderContext) {
		if (!this.color) return
		ctx.push()
		ctx.setFillColor(this.color)
		ctx.setStrokeColor(this.color)
		ctx.drawRect(this.x, this.y, this.w, this.h)
		ctx.pop()
	}

	public setBounceFactor(bounce: number): void { this.bounce = bounce }
	public getBounceFactor(): number { return this.bounce }

	public getBounds(): Vector2D { return { x: this.w, y: this.h } }

	public getPos(): Vector2D { return { x: this.x, y: this.y } }

	public getVel(): Vector2D { return this.vel }

	public onCollision({ entity }: { entity: IPhysics }): void {
		GameLogger.info(`Collision: ${this.getShape()} + ${entity.getShape()}`)
	}

	public setVel(vel: Vector2D): void { this.vel = vel }

	public setMass(mass: number): void { this.mass = mass }

	public getMass(): number { return this.mass }
	public setPos(pos: Vector2D): void { this.x = pos.x; this.y = pos.y }
	public getFriction(): number { return this.friction ?? 1 }

	public setFriction(friction: number): void { this.friction = friction }

	/**
		 * Platzhalter für zeitgesteuerte Logik (Animationen, Farbwechsel).
		 * @param _deltatime - Zeitintervall seit dem letzten Update.
		 * @param _globalfriction - Reibung (wird hier ignoriert, da statisch).
		 */
	public tick(_deltatime: number, _globalfriction: number): void { }

	/** @returns Immer "rectangle" für den Physics-Dispatcher. */
	public getShape(): "rectangle" { return this.shape }
	public physicsEnabled(): boolean { return this.isPhysicsEnabled }
}
