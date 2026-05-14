import type { RenderContext } from "../engine/RenderContext"
import type { IPhysics, IPhysicsRectangle, Vector2D } from "../physics/physics"
import { GameLogger } from "../utils/log"
import type { IStructure } from "./structures"

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
	/** Extrem hohe Masse (9000), damit das Objekt bei Kollisionen unbeweglich bleibt. */
	private mass: number = 9000;
	/** Bestimmt das Abprall-Verhalten (Standard 0: absorbiert Energie). */
	private bounce: number;

	private color: string
	private vel: Vector2D

	// @ts-ignore
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
	constructor(x: number, y: number, w: number, h: number, color: string) {
		this.x = x
		this.y = y
		this.w = w
		this.h = h
		this.color = color || "green"
		this.shape = "rectangle"
		this.vel = { x: 0, y: 0 }
		this.bounce = Infinity
	}

	/**
		 * Zeichnet das Rechteck basierend auf den Dimensionen w und h.
		 */
	draw(ctx: RenderContext) {
		ctx.setFillColor(this.color)
		ctx.drawRect(this.x, this.y, this.w, this.h)
	}

	setBounceFactor(bounce: number): void { this.bounce = bounce }
	getBounceFactor(): number { return this.bounce }

	getBounds(): Vector2D { return { x: this.w, y: this.h } }

	getPos(): Vector2D { return { x: this.x, y: this.y } }

	getVel(): Vector2D { return this.vel }

	onCollision({ entity }: { entity: IPhysics }): void {
		GameLogger.debug("Collision with:" + entity.getShape())
	}

	setVel(vel: Vector2D): void { this.vel = vel }

	setMass(mass: number): void { this.mass = mass }

	getMass(): number { return this.mass }

	setPos(pos: Vector2D): void { this.x = pos.x; this.y = pos.y }
	getFriction(): number { return this.friction ?? 1 }

	setFriction(friction: number): void { this.friction = friction }

	/**
		 * Platzhalter für zeitgesteuerte Logik (Animationen, Farbwechsel).
		 * @param _deltatime - Zeitintervall seit dem letzten Update.
		 * @param _globalfriction - Reibung (wird hier ignoriert, da statisch).
		 */
	tick(_deltatime: number, _globalfriction: number): void { }

	/** @returns Immer "rectangle" für den Physics-Dispatcher. */
	getShape(): "rectangle" { return this.shape }
}
