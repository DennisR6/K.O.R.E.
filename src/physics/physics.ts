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

/**
 * Das mathematische Gehirn der Engine.
 * 
 * Dieses Interface erzwingt, dass jede Physik-Implementierung (z.B. Arcade, Realistic)
 * sowohl die Rechenlogik (Vektoren) als auch die physikalischen Regeln (Kollision) definiert.
 */
export interface PhysicsStrategy {
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
	checkCollisionCircles(entityA: IPhysicsCircle, entityB: IPhysicsCircle): boolean;

	/** Prüft, ob sich zwei Rechtecke überschneiden. */
	checkCollisionRects(entityA: IPhysicsRectangle, entityB: IPhysicsRectangle): boolean;

	/** Die All-in-One Prüfung: Erkennt automatisch, welche Formen kollidieren. */
	checkCollision(entityA: IPhysics, entityB: IPhysics): boolean;

	/** Spezialprüfung: Kollision zwischen einem Kreis und einem Rechteck. */
	checkCollisionCircleRect(entityA: IPhysicsCircle, entityB: IPhysicsRectangle): boolean;

	/** Löst die Kollision auf (schubst Objekte auseinander, damit sie nicht ineinander stecken). */
	handleCollision(entityA: IPhysics, entityB: IPhysics): void;

	/** Gibt den aktuellen Reibungswert zurück. */
	getFriction(): number;

	/** Gibt einem Objekt einen Stoß in eine bestimmte Richtung mit einer gewissen Kraft. */
	applyImpulse(entity: IPhysics, angle: number, power: number): void;

	/** Verlangsamt ein Objekt basierend auf der Zeit (bremst es ab). */
	applyFriction(entity: IPhysics, dt: number): void;

	/** Sagt voraus, wo ein Objekt stehen bleiben wird (Bremspfad-Vorschau). */
	calculateStop(startPos: Vector2D, initialVel: Vector2D): Vector2D;

	/** Sagt voraus, wo ein Objekt nach einem geplanten Stoß landen wird. */
	calculateStopFromInput(startPos: Vector2D, angle: number, power: number): Vector2D;

	// --- DEBUG ---
	/** Schreibt die aktuellen Einstellungen der Physik-Engine in die Konsole. */
	printSettings(who?: string): void;
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
	onCollision({ entity }: { entity: IPhysics }): void;

	/** Wie stark das Objekt abprallt (0 = gar nicht, 1 = wie ein Gummiball). */
	getBounceFactor(): number;
}
/** Ein rundes Objekt (z.B. ein Ball oder ein Spieler-Pin). */
export interface IPhysicsCircle extends IdefaultPhysics {
	/** Gibt "circle" zurück, damit die Engine weiß, wie man Kollisionen rechnet. */
	getShape(): "circle";
	/** Der Radius des Kreises. */
	getBounds(): { radius: number };
}

/** Ein eckiges Objekt (z.B. eine Wand, ein Tor oder ein Hindernis). */
export interface IPhysicsRectangle extends IdefaultPhysics {
	/** Gibt "rectangle" zurück. */
	getShape(): "rectangle";
	/** Breite und Höhe des Rechtecks. */
	getBounds(): { width: number, height: number };
}

/** 
 * Kombi-Typ: Ein Objekt in der Physik-Engine ist ENTWEDER ein Kreis ODER ein Rechteck. 
 * (Es kann in der Zukunft Erweitert werden, aber aktuell sind es nur die 2) */
export type IPhysics = IPhysicsCircle | IPhysicsRectangle;
