import { type Effect, type EffectSettings, type SettingKey, type SettingValue } from "../effects/types.js";
import type { RenderContext } from "../kore/runtime/RenderContext.js"
import type { ISettingsSerialize } from "../kore/runtime/types.js";
import { getShapeName, SHAPE, type IPhysics, type StructureCollisionRole, type Vector2D } from "../physics/physics.js"
import type { MapBoundarySettingsLine } from "../settings/settings.js";
import type { IStructure } from "./types.js";
import { deriveStructureId } from "./identity.js";
import type { CollisionCommandBinding } from "../engine/sdk/collisionCommand.js";

/**
 * Repräsentiert ein statisches Liniensegment (z.B. eine Bande oder Mauer).
 * Die Start- und Endpunkte sind absolute Weltkoordinaten.
 * @implements {IStructure} Basis-Interface für Hindernisse.
 * @implements {IPhysics<SHAPE.LINE>} Notwendig für die Kreis-Linien-Kollisionslogik.
 */
export class StructureLine implements IStructure, IPhysics<SHAPE.LINE>, ISettingsSerialize<MapBoundarySettingsLine> {
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
	private isDrawingEnabled: boolean = true;
	private readonly id: string
	private serializeState: boolean

	// @ts-ignore
	private effects: Effect[] = []
	// aktuell brauchen wir diese noch nicht.
	// Aber für die Items später dann schon
	private friction: number | undefined

	/**
	 * @param x - Start X.
	 * @param y - Start Y.
	 * @param x2 - End X.
	 * @param y2 - End Y.
		 * @param color - Farbe der Wand.
		 */
	constructor(x: number, y: number, x2: number, y2: number, color: string, effects: EffectSettings[] = [], id?: string, physicsEnabled?: boolean, drawingEnabled?: boolean, _collisionCommands: CollisionCommandBinding[] = []) {
		// Zero-length lines have no valid segment direction and would corrupt
		// the collision normal (Task 13.4). Reject them at construction so no
		// arbitrary fallback direction is silently invented.
		if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
			throw new Error("Line structures must have finite coordinates");
		}
		if (x === x2 && y === y2) {
			throw new Error("Line structures must have non-zero length");
		}
		this.position = { x, y }
		this.w = x2
		this.h = y2
		this.color = color || "green"
		this.shape = SHAPE.LINE
		this.vel = { x: 0, y: 0 }
		this.bounce = Infinity
		this.id = id ?? deriveStructureId({ type: SHAPE.LINE, x, y, x2, y2, color, effects: [] });
		this.serializeState = id !== undefined || physicsEnabled !== undefined || drawingEnabled !== undefined;
		this.isPhysicsEnabled = physicsEnabled ?? true;
		this.isDrawingEnabled = drawingEnabled ?? true;
		this.effects = []
		for (const effect of effects) {
			switch (effect.type) {
				default: console.log(`Effect not implemented in ${getShapeName(this.shape)}`, effect)
			}
		}
	}

	public draw(ctx: RenderContext) {
		if (!this.color || !this.isDrawingEnabled) return
		ctx.setFillColor(this.color)
		ctx.setStrokeColor(this.color)
		ctx.line(this.position.x, this.position.y, this.w, this.h)
	}

	public setBounceFactor(bounce: number): void { this.bounce = bounce }
	public getBounceFactor(): number { return this.bounce }

	/**
	 * Gibt den absoluten Endpunkt für die Kollisionsabfrage zurück.
		 */
	public getBounds(): Vector2D { return { x: this.w, y: this.h } }

	/**
	 * Gibt den Startpunkt zurück.
		 */
	public getPos(): Vector2D { return { x: this.position.x, y: this.position.y } }
	public getVel(): Vector2D { return this.vel }

	public onCollision({ }: { entity: IPhysics<SHAPE> }): void { }
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
	public setPhysicsEnabled(physicsEnabled: boolean): void { this.isPhysicsEnabled = physicsEnabled; this.serializeState = true }
	public drawingEnabled(): boolean { return this.isDrawingEnabled }
	public setDrawingEnabled(drawingEnabled: boolean): void { this.isDrawingEnabled = drawingEnabled; this.serializeState = true }
	public getId(): string { return this.id }
	public setSetting(key: SettingKey, value: SettingValue): void { if (typeof value !== "boolean") return; if (key === "physicsEnabled") this.setPhysicsEnabled(value); else if (key === "drawingEnabled") this.setDrawingEnabled(value); }
	public addSetting(key: SettingKey, value: SettingValue): void { this.setSetting(key, value); }
	public removeSetting(key: SettingKey, value: SettingValue): void { if (typeof value === "boolean") this.setSetting(key, !value); }
	public getCollisionCommands(): readonly CollisionCommandBinding[] { return []; }
	public setColor(color: string | undefined) { this.color = color }
	/** Line segments are collision obstacles only and never containment. */
	public getCollisionRole(): StructureCollisionRole | undefined { return undefined }
	public toSettings(): MapBoundarySettingsLine {
		const out: MapBoundarySettingsLine = { type: SHAPE.LINE, x: this.position.x, y: this.position.y, x2: this.w, y2: this.h, color: this.color, effects: [] };
		if (this.serializeState) { out.id = this.id; out.physicsEnabled = this.isPhysicsEnabled; out.drawingEnabled = this.isDrawingEnabled; }
		return out;
	}
	public getEffects(): EffectSettings[] { return [] }
	public getType(): SHAPE.LINE { return this.shape }
	public getX(): number { return this.position.x }
	public getY(): number { return this.position.y }

	public apply(settings: MapBoundarySettingsLine): void { throw new Error("TODO!" + settings) }
}
