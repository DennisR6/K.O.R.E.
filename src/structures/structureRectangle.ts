import { EffectType, type Effect } from "../effects/types.js";
import type { RenderContext } from "../engine/RenderContext.js"
import { getShapeName, SHAPE, type IPhysics, type Vector2D } from "../physics/physics.js"
import { type IStructure } from "./types.js";

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
export class StructureRectangle implements IStructure, IPhysics<SHAPE.RECTANGLE> {
	/** X-Koordinate der oberen linken Ecke. */
	private x: number;
	/** Y-Koordinate der oberen linken Ecke. */
	private y: number;
	/** Breite (Width) des Rechtecks. */
	private w: number;
	/** Höhe (Height) des Rechtecks. */
	private h: number;
	private effects: Effect[]
	/** Kennung der Form für das Physik-System. */
	private shape: SHAPE.RECTANGLE;
	/** Extrem hohe Masse (Infinity), damit das Objekt bei Kollisionen unbeweglich bleibt. */
	private mass: number = Infinity;
	/** Bestimmt das Abprall-Verhalten (Standard 0: absorbiert Energie). */
	private bounce: number;

	private color: string | undefined
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
	constructor(x: number, y: number, w: number, h: number, color?: string, effects: Effect[] = []) {
		this.x = x
		this.y = y
		this.w = w
		this.h = h
		this.color = color
		this.shape = SHAPE.RECTANGLE
		this.vel = { x: 0, y: 0 }
		this.bounce = Infinity
		this.effects = []
		for (const effect of effects) {
			switch (effect.getType()) {
				//@ts-ignore
				case EffectType.Damage: this.effects.push(new EffectDamage(effect.values.damage)); break;
				default: console.log(`Effect not implemented in ${getShapeName(this.shape)}`, effect)
			}
		}
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

	public onCollision({ }: { entity: IPhysics<SHAPE> }): void {
		// console.log(`Collision: ${getShapeName(this.getShape())} + ${getShapeName(entity.getShape())}`)
	}

	public setVel(vel: Vector2D): void { this.vel = vel }

	public setMass(mass: number): void { this.mass = mass }

	public getMass(): number { return this.mass }
	public setPos(pos: Vector2D): void { this.x = pos.x; this.y = pos.y; }
	public getFriction(): number { return this.friction ?? 1 }

	public setFriction(friction: number): void { this.friction = friction }

	/**
		 * Platzhalter für zeitgesteuerte Logik (Animationen, Farbwechsel).
		 * @param _deltatime - Zeitintervall seit dem letzten Update.
		 * @param _globalfriction - Reibung (wird hier ignoriert, da statisch).
		 */
	public tick(_deltatime: number, _globalfriction: number): void { }

	/** @returns Immer "rectangle" für den Physics-Dispatcher. */
	public getShape(): SHAPE.RECTANGLE { return this.shape }
	public physicsEnabled(): boolean { return this.isPhysicsEnabled }
	public setPhysicsEnabled(physicsEnabled: boolean) { this.isPhysicsEnabled = physicsEnabled }
	public setColor(color: string | undefined) { this.color = color }
	// public toSettings(): MapBoundarySettingsRect<EffectType, EffectTrigger> {
	// 	return { type: SHAPE.RECTANGLE, x: this.x, y: this.y, w: this.w, h: this.h, color: this.color, effects: this.effects }
	// }
	// public getEffects(): SettingsEffect<EffectType, EffectTrigger>[] { return this.effects }
	public getType(): SHAPE.RECTANGLE { return this.shape }
	public getX(): number { return this.x }
	public getY(): number { return this.y }
}
