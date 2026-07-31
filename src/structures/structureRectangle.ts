import { MetaEffect } from "../effects/effects.js";
import { EffectTrigger, type Effect, type FullEffectSettings } from "../effects/types.js";
import type { RenderContext } from "../engine/RenderContext.js"
import type { ISettingsSerialize } from "../engine/types.js";
import { SHAPE, type IPhysics, type StructureCollisionRole, type Vector2D } from "../physics/physics.js"
import type { MapBoundarySettingsRect } from "../settings/settings.js";
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
export class StructureRectangle implements IStructure, IPhysics<SHAPE.RECTANGLE>, ISettingsSerialize<MapBoundarySettingsRect> {
	/** X-Koordinate der oberen linken Ecke. */
	private x: number;
	/** Y-Koordinate der oberen linken Ecke. */
	private y: number;
	/** Breite (Width) des Rechtecks. */
	private w: number;
	/** Höhe (Height) des Rechtecks. */
	private h: number;
	private collisionEffects: Effect[] = []
	private roundEffects: Effect[] = []
	private alwaysEffects: Effect[] = []
	/** Kennung der Form für das Physik-System. */
	private shape: SHAPE.RECTANGLE;
	/** Extrem hohe Masse (Infinity), damit das Objekt bei Kollisionen unbeweglich bleibt. */
	private mass: number = Infinity;
	/** Bestimmt das Abprall-Verhalten (Standard 0: absorbiert Energie). */
	private bounce: number;

	private color: string | undefined
	private vel: Vector2D
	private isPhysicsEnabled: boolean = true
	private collisionRole: StructureCollisionRole | undefined

	// aktuell brauchen wir diese noch nicht.
	// Aber für die Items später dann schon
	private friction: number | undefined

	/**
	 * @param x - Start X (Top-Left).
	 * @param y - Start Y (Top-Left).
	 * @param w - Breite des Blocks.
	 * @param h - Höhe des Blocks.
	 * @param color - Füllfarbe des Rechtecks.
	 * @param effects - Serialisierte Kollisions-/Runden-/Dauer-Effekte.
	 * @param role - Explizite Strukturrolle ("solid", "containment", "both").
	 */
	constructor(x: number, y: number, w: number, h: number, color?: string, effects: FullEffectSettings[] = [], role?: StructureCollisionRole) {
		this.x = x
		this.y = y
		this.w = w
		this.h = h
		this.color = color
		this.shape = SHAPE.RECTANGLE
		this.vel = { x: 0, y: 0 }
		this.bounce = Infinity
		this.collisionRole = role
		for (const eff of effects) {
			switch (eff.trigger) {
				case EffectTrigger.Collision: this.collisionEffects.push(new MetaEffect(eff)); continue
				case EffectTrigger.Round: this.roundEffects.push(new MetaEffect(eff)); continue
				case EffectTrigger.Always: this.alwaysEffects.push(new MetaEffect(eff)); continue
				default: console.log("this is not implemted yet"); continue
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

	public onCollision({ entity }: { entity: IPhysics<SHAPE> }): void {
		this.collisionEffects.forEach(effect => effect.apply(entity))
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
	public getCollisionRole(): StructureCollisionRole | undefined { return this.collisionRole }
	public setCollisionRole(role: StructureCollisionRole | undefined): void { this.collisionRole = role }
	public toSettings(): MapBoundarySettingsRect {
		const effects: FullEffectSettings[] = []
		this.alwaysEffects.forEach(effect => effects.push({ trigger: EffectTrigger.Always, triggerValue: [], ...effect.toSettings() }))
		this.collisionEffects.forEach(effect => effects.push({ trigger: EffectTrigger.Collision, triggerValue: [], ...effect.toSettings() }))
		this.roundEffects.forEach(effect => effects.push({ trigger: EffectTrigger.Round, triggerValue: [], ...effect.toSettings() }))
		const out: MapBoundarySettingsRect = {
			type: SHAPE.RECTANGLE,
			x: this.x,
			y: this.y,
			w: this.w,
			h: this.h,
			color: this.color,
			effects,
		}
		if (this.collisionRole !== undefined) out.role = this.collisionRole
		return out
	}
	//
	// public getEffects(): SettingsEffect<EffectType, EffectTrigger>[] { return this.effects }
	public getType(): SHAPE.RECTANGLE { return this.shape }
	public getX(): number { return this.x }
	public getY(): number { return this.y }
}
