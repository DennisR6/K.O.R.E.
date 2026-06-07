import { EffectType, type Effect, type EffectTrigger } from "../effects/types.js";
import type { RenderContext } from "../engine/RenderContext.js"
import type { ISettingsSerialize } from "../engine/types.js";
import { getShapeName, SHAPE, type IPhysics, type Vector2D } from "../physics/physics.js"
import type { MapBoundarySettingsLine, SettingsEffect } from "../settings/settings.js";
import type { IStructure } from "./types.js";

/**
 * Repräsentiert ein statisches, rechteckiges Hindernis (z.B. eine Bande oder Mauer).
 * 
 * Auch wenn der Name "Line" vermutet lässt, definiert dieses Objekt physikalisch
 * ein Rechteck über Startpunkt (x, y) sowie Breite und Höhe (x2, y2).
 * @implements {IStructure} Basis-Interface für Hindernisse.
 * @implements {IPhysicsRectangle} Notwendig für die Kreis-Rechteck-Kollisionslogik.
 */
export class StructureLine implements IStructure, IPhysics<SHAPE.LINE>, ISettingsSerialize<MapBoundarySettingsLine<EffectType, EffectTrigger>> {
	/** Koordinaten der Linie. */
	private position: Vector2D
	private w: number; //x2
	private h: number; //y2

	/** Kennung der Form für das Physik-System. */
	private shape: SHAPE.LINE
	/** Extrem hohe Masse (Infinity), damit Wände niemals weggeschoben werden können. */
	private mass: number = Infinity;
	/** Rückprall-Koeffizient (0 = kein Abprallen, die Kugel "klebt" fast an der Wand). */

	private bounce: number;
	private color: string | undefined
	private vel: Vector2D
	private isPhysicsEnabled: boolean = true;

	private effects: Effect[]
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
	constructor(x: number, y: number, x2: number, y2: number, color: string, effects: SettingsEffect<EffectType, EffectTrigger>[] = []) {
		this.position = { x, y }
		this.w = x2
		this.h = y2
		this.color = color || "green"
		this.shape = SHAPE.LINE
		this.vel = { x: 0, y: 0 }
		this.bounce = Infinity
		this.effects = []
		for (const effect of effects) {
			switch (effect.type) {
				default: console.log(`Effect not implemented in ${getShapeName(this.shape)}`, effect)
			}
		}
	}

	public draw(ctx: RenderContext) {
		if (!this.color) return
		ctx.setFillColor(this.color)
		ctx.setStrokeColor(this.color)
		ctx.line(this.position.x, this.position.y, this.w, this.h)
	}

	public setBounceFactor(bounce: number): void { this.bounce = bounce }
	public getBounceFactor(): number { return this.bounce }

	/**
		 * Gibt die Dimensionen für die Kollisionsabfrage zurück.
		 * @returns {width, height} Breite und Höhe des Objekts.
		 */
	public getBounds(): Vector2D { return { x: this.w, y: this.h } }

	/**
		 * Gibt den Ankerpunkt zurück. 
		 * Bei Rechtecken ist dies im Gegensatz zu Kreisen meist die obere linke Ecke.
		 */
	public getPos(): Vector2D { return { x: this.position.x, y: this.position.y } }
	public getVel(): Vector2D { return this.vel }

	public onCollision({ entity }: { entity: IPhysics<SHAPE> }): void {
		console.log(`Collision: ${getShapeName(this.getShape())} + ${getShapeName(entity.getShape())}`)
	}
	public setVel(vel: Vector2D): void { this.vel = vel }
	public setMass(mass: number): void { this.mass = mass }
	public getMass(): number { return this.mass }
	public setPos(pos: Vector2D): void { this.position = { ...pos } }
	public setFriction(friction: number): void { this.friction = friction }
	public getFriction(): number { return this.friction ?? 1 }

	/**
		 * Logik-Update für Animationen oder Zeit-Effekte.
		 * @param _deltatime - Vergangene Zeit.
		 * @param _globalfriction - Globale Reibung (wird von statischen Wänden ignoriert).
		 */
	public tick(_deltatime: number, _globalfriction: number): void { }

	/** @returns Immer "rectangle" für den Collision-Dispatcher. */
	public getShape(): SHAPE.LINE { return this.shape }
	public physicsEnabled(): boolean { return this.isPhysicsEnabled }
	public setPhysicsEnabled(physicsEnabled: boolean): void { this.isPhysicsEnabled = physicsEnabled }
	public setColor(color: string | undefined) { this.color = color }
	public toSettings(): MapBoundarySettingsLine<EffectType, EffectTrigger> {
		return { type: SHAPE.LINE, x: this.position.x, y: this.position.y, x2: this.w, y2: this.h, color: this.color, effects: this.effects }
	}
	public getEffects(): SettingsEffect<EffectType, EffectTrigger>[] { return this.effects }
	public getType(): SHAPE.LINE { return this.shape }
	public getX(): number { return this.position.x }
	public getY(): number { return this.position.y }
}
