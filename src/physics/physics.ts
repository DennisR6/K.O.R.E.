import type { ISettingsSerialize } from "../engine/types.js";
import type { EntityManager } from "../entity/EntityManager.js";
import type { FrictionSettings } from "../settings/settings.js";

/**
 * Ein Punkt oder eine Richtung im 2D-Raum.
 * 
 * Stell es dir wie ein Koordinatensystem vor:
 * - X: Horizontale Position (Links/Rechts)
 * - Y: Vertikale Position (Oben/Unten)
 */
export interface Vector2D {
	/** Die Position auf der horizontalen Achse. */
	x: number;
	/** Die Position auf der vertikalen Achse. */
	y: number;
}

/** Returns the unit forward vector for a clockwise screen-space rotation in degrees. */
export function forwardVectorFromRotation(rotation: number): Vector2D {
	const radians = (rotation * Math.PI) / 180;
	return { x: Math.cos(radians), y: Math.sin(radians) };
}

/**
 * Das mathematische Gehirn der Engine.
 * 
 * Dieses Interface erzwingt, dass jede Physik-Implementierung (z.B. Arcade, Realistic)
 * sowohl die Rechenlogik (Vektoren) als auch die physikalischen Regeln (Kollision) definiert.
 */
export interface PhysicsStrategy extends ISettingsSerialize<FrictionSettings> {
	/** Berechnet den Abprall-Vektor (wie ein Ball an der Wand). */
	calculateBounce(vel: Vector2D, normal: Vector2D): Vector2D;

	/** Plus: Rechnet zwei Vektoren zusammen. */
	add(a: Vector2D, b: Vector2D): Vector2D;

	/** Minus: Zieht Vektor B von A ab. */
	sub(a: Vector2D, b: Vector2D): Vector2D;

	/** Mal: Macht einen Vektor um einen Faktor länger oder kürzer. */
	mult(a: Vector2D, b: number): Vector2D;

	/** Berechnet das Punktprodukt (hilft z.B. Winkel zwischen Objekten zu bestimmen). */
	dot(a: Vector2D, b: Vector2D): number;

	/** Länge des Vektors zum Quadrat (schneller als mag). */
	magSq(v: Vector2D): number;

	/** Die echte Länge eines Vektors (Abstand von Nullpunkt). */
	mag(v: Vector2D): number;

	/** Kürzt den Vektor auf die Länge 1 (nur noch die Richtung bleibt übrig). */
	normalize(v: Vector2D): Vector2D;

	/** Berechnet den Abstand zwischen zwei Punkten. */
	dist(a: Vector2D, b: Vector2D): number;

	/** Abstand im Quadrat (gut für schnelle Entfernungs-Checks). */
	distSq(a: Vector2D, b: Vector2D): number;

	/** Hält eine Zahl innerhalb von Min und Max fest. */
	clamp(val: number, min: number, max: number): number;

	// --- Kollisions-Logik ---

	/** Prüft, ob sich zwei Kreise berühren. */
	checkCollisionCircles(entityA: IPhysics<SHAPE.CIRCLE>, entityB: IPhysics<SHAPE.CIRCLE>): boolean;

	/** Prüft, ob sich zwei Rechtecke überschneiden. */
	checkCollisionRects(entityA: IPhysics<SHAPE.RECTANGLE>, entityB: IPhysics<SHAPE.RECTANGLE>): boolean;

	/** Die All-in-One Prüfung: Erkennt automatisch, welche Formen kollidieren. */
	checkCollision(entityA: IPhysics<any>, entityB: IPhysics<any>): boolean;

	/** Spezialprüfung: Kollision zwischen einem Kreis und einem Rechteck. */
	checkCollisionCircleRect(entityA: IPhysics<SHAPE.CIRCLE>, entityB: IPhysics<SHAPE.RECTANGLE>): boolean;

	/** Löst die Kollision auf (schubst Objekte auseinander, damit sie nicht ineinander stecken). */
	handleCollision(entityA: IPhysics<any>, entityB: IPhysics<any>): void;

	/** Gibt den aktuellen Reibungswert zurück. */
	getFriction(): number;
	getStopThreshold(): number;

	/** Gibt einem Objekt einen Stoß in eine bestimmte Richtung mit einer gewissen Kraft. */
	applyImpulse(entity: IPhysics<any>, angle: number, power: number): void;

	/** Verlangsamt ein Objekt basierend auf der Zeit (bremst es ab). */
	applyFriction(entity: IPhysics<any>, dt: number): void;

	/** Sagt voraus, wo ein Objekt stehen bleiben wird (Bremspfad-Vorschau). */
	calculateStop(startPos: Vector2D, initialVel: Vector2D): Vector2D;

	/** Sagt voraus, wo ein Objekt nach einem geplanten Stoß landen wird. */
	calculateStopFromInput(startPos: Vector2D, angle: number, power: number): Vector2D;

	// --- DEBUG ---
	/** Schreibt die aktuellen Einstellungen der Physik-Engine in die Konsole. */
	printSettings(who?: string): void;
	isStatic(entity: EntityManager): boolean;
}
/** 
 * Die physikalischen Grundeigenschaften für jedes Objekt im Spiel.
 * Hier legst du fest, wie schwer ein Objekt ist, wie schnell es sich bewegt und was passiert, wenn es knallt.
 */
export interface IdefaultPhysics {
	/** Setzt die aktuelle Geschwindigkeit. */
	setVel(vel: Vector2D): void;
	/** Setzt das Gewicht des Objekts (Wichtig für Kollisionen: Schwer schubst Leicht). */
	setMass(mass: number): void;
	/** Teleportiert das Objekt an eine bestimmte Stelle. */
	setPos(pos: Vector2D): void;
	getPos(): Vector2D;

	/** Wie stark das Objekt von selbst abbremst (Gelände-Abhängig). */
	getFriction(): number | undefined;
	setFriction(friction: number): void;

	getMass(): number;
	getVel(): Vector2D;

	/** 
	 * Diese Funktion wird aufgerufen, wenn das Objekt etwas berührt. 
	 * Hier kann man z.B. Sounds abspielen oder Punkte zählen.
	 */
	onCollision({ entity }: { entity: IPhysics<SHAPE> }): void;

	setBounceFactor(bounce: number): void;
	/** Wie stark das Objekt abprallt (0 = gar nicht, 1 = wie ein Gummiball). */
	getBounceFactor(): number;
	getBounds(): Vector2D
	physicsEnabled(): boolean;
	setPhysicsEnabled(physicsEnabled: boolean): void;
	getShape(): SHAPE
}
/** Ein rundes Objekt (z.B. ein Ball oder ein Spieler-Pin). */
export interface CirclePhysics extends IdefaultPhysics { getShape(): SHAPE.CIRCLE; }
/** Ein eckiges Objekt (z.B. eine Wand, ein Tor oder ein Hindernis). */
export interface RectanglePhysics extends IdefaultPhysics { getShape(): SHAPE.RECTANGLE; }
export interface LinePhysics extends IdefaultPhysics { getShape(): SHAPE.LINE; }

/** 
 * Kombi-Typ: Ein Objekt in der Physik-Engine ist ENTWEDER ein Kreis ODER ein Rechteck. 
 * (Es kann in der Zukunft Erweitert werden, aber aktuell sind es nur die 2) */
export const enum SHAPE { CIRCLE, LINE, RECTANGLE }
export type PhyicsMap = {
	[SHAPE.CIRCLE]: CirclePhysics
	[SHAPE.RECTANGLE]: RectanglePhysics
	[SHAPE.LINE]: LinePhysics
}
export type IPhysics<T extends SHAPE> = PhyicsMap[T]

export function getShapeName(input: SHAPE): string {
	switch (input) {
		case SHAPE.CIRCLE: return "circle"
		case SHAPE.RECTANGLE: return "rectangle"
		case SHAPE.LINE: return "line"
		default: return "TODO"
	}
}
