import { ASSET_KEYS } from "../assetManager/assets/assetRegistry.js";
import type { RenderContext } from "../engine/RenderContext.js";
import type { IPhysics, Vector2D } from "../physics/physics.js";
import type { IEntity } from "./Entity.js";


/**
 * Das Konfigurations-Interface für einen Spieler.
 * 
 * Es dient als Vorlage (Data Transfer Object), um einen Spieler mit 
 * individuellen Eigenschaften wie Teamzugehörigkeit, Farbe oder Icons zu erstellen.
 * Alle Eigenschaften außer den Koordinaten sind optional, um maximale Flexibilität
 * beim Erstellen von Gast-Accounts oder Standard-Entities zu bieten.
 */
export interface IPlayerType {
	/** 
	 * Eindeutige ID des Spielers. 
	 * Wenn nicht angegeben, generiert die Engine meist eine temporäre ID. 
	 */
	id?: number | string;

	/** Startposition auf der X-Achse (Welt-Einheiten). */
	x: number;

	/** Startposition auf der Y-Achse (Welt-Einheiten). */
	y: number;

	/** 
	 * Team-Zugehörigkeit. 
	 * Kann genutzt werden, um Kollisionen im selben Team zu ignorieren 
	 * oder für die Punkteberechnung.
	 */
	team?: string[];

	/** 
	 * Die Primärfarbe des Spielers.
	 * Wird vom Renderer genutzt, um den Kreis oder Effekte einzufärben.
	 */
	color?: string;

	/** 
	 * Pfad oder Schlüssel für das Icon/Avatar.
	 * Der P5Renderer nutzt dies, um die entsprechende Textur aus dem Cache zu laden.
	 */
	playericon?: string;

	/** 
	 * Der physikalische Radius (Größe) des Spielers.
	 * Standardwert ist meist 12, falls hier nichts definiert wird.
	 */
	size?: number;
	hoop?: string;
}

/**
 * Die Player-Klasse ist die konkrete Umsetzung einer IEntity.
 * 
 * Sie kombiniert:
 * 1. **Physik**: Geschwindigkeit (Velocity), Masse und Reibung.
 * 2. **Darstellung**: Zeichnet sich selbst und einen kleinen Richtungsvektor (Velocity-Line).
 * 3. **Debugging**: Kann Mutationen tracken, um unerwartete Wertänderungen zu finden.
 */
export class Player implements IEntity {
	private hp: number = 30;
	private dead: number = -1;
	/** Eindeutige ID (wird via crypto.randomUUID() generiert, falls nicht vorhanden). */
	private id: number | string;
	/** Die aktuelle Position auf dem Spielfeld (Top-Left des Begrenzungsrahmens). */
	private position: Vector2D;
	/** Aktuelle Bewegungsrichtung und Geschwindigkeit. */
	private velocity: Vector2D;
	/** Bestimmt, wie stark das Objekt bei Kollisionen abprallt (0 bis 1). */
	private bouncyness: number;
	/** Trägheit des Objekts bei Kollisionen. */
	private mass: number = 1;
	/** Der Radius des Spielers. */
	private size: number = 1;
	/** Individuelle Reibung (überschreibt bei Bedarf die globale Reibung). */
	private friction: number | undefined;

	private team: string[];
	private color: string;
	private playericon: string;
	private shape: "circle"
	private hoop: string

	constructor() {
		// Standardwerte für ein leeres Objekt
		this.id = 0
		this.position = { x: 0, y: 0 }
		this.team = []
		this.color = "red"
		this.playericon = ""
		this.shape = "circle"
		this.velocity = { x: 0, y: 0 } as Vector2D
		this.bouncyness = 1
		this.friction = undefined;
		this.size = 20;
		this.mass = 1
		this.hoop = ASSET_KEYS.pictureReifenWEBP
	}

	/**
		 * Initialisiert den Spieler mit echten Daten.
		 * Berechnet die Position so, dass der Ankerpunkt in der Mitte liegt.
		 * @param player - Die Konfigurationsdaten (IPlayer).
		 */
	public new(player: IPlayerType) {
		this.setId(player.id || crypto.randomUUID())
		this.setPos({ x: player.x, y: player.y })
		this.setVel({ x: 0, y: 0 })
		this.team = player.team ?? this.team;
		this.setColor(player.color ?? "red")
		this.setPlayerIcon(player.playericon ?? this.playericon)
		this.setSize(player.size ?? 20)
		this.shape = "circle";
		return this;
	}

	/**
		 * Zeichnet den Spieler und einen Richtungsvektor.
		 * Der Richtungsvektor hilft dem Spieler zu sehen, wohin sich der Puck bewegt.
		 */
	public draw(ctx: RenderContext): void {
		if (this.hp <= 0) return
		// ctx.drawRect(this.position.x - this.size - 5, this.position.y - this.size - 10, this.getHP(), 5)
		// ctx.line(this.position.x - this.size, this.position.y - this.size, this.position.x + this.size, this.position.y - this.size)
		// ctx.line(this.position.x + this.size, this.position.y + this.size, this.position.x + this.size, this.position.y - this.size)
		// ctx.line(this.position.x - this.size, this.position.y + this.size, this.position.x - this.size, this.position.y - this.size)
		// ctx.line(this.position.x - this.size, this.position.y + this.size, this.position.x + this.size, this.position.y + this.size)

		// ctx.setFillColor(this.color);
		// ctx.drawCircle(this.position.x, this.position.y, this.size);

		ctx.drawImage(this.hoop, this.position.x - this.size, this.position.y - this.size, this.size * 2, this.size * 2);
		ctx.drawImage(this.playericon, this.position.x - this.size, this.position.y - this.size, this.size * 2, this.size * 2);
	}

	/**
		 * Integriert die Geschwindigkeit in die Position basierend auf der vergangenen Zeit.
		 * @param deltaTime - Zeit seit dem letzten Physik-Schritt.
		 */
	public tick(deltaTime: number, _globalFriction: number) {
		if (this.hp <= 0) {
			this.position.x = 1_000_000;
			this.position.y += 1_000_000;
			this.velocity.x = 0
			this.velocity.y = 0
			return
		}
		this.position.x += this.velocity.x * deltaTime;
		this.position.y += this.velocity.y * deltaTime;
	}

	public setId(id: string | number): void { this.id = id }
	public getId(): number | string { return this.id }
	public setMass(inertia: number): void { this.mass = Math.min(inertia, 1) }
	public getMass(): number { return this.mass }
	public setVel(v: { x: number, y: number }) { this.velocity.x = v.x; this.velocity.y = v.y; }
	public getVel() { return { x: this.velocity.x, y: this.velocity.y }; }
	public setBounceFactor(bounce: number): void { this.bouncyness = bounce }
	public getBounds(): Vector2D { return { x: this.size, y: this.size } }
	public getBounceFactor(): number { return this.bouncyness }
	public setPos(pos: Vector2D): void { this.position = { x: pos.x, y: pos.y } }
	public getPos(): Vector2D { return { x: this.position.x, y: this.position.y } }

	public setFriction(friction: number): void { this.friction = friction }
	public getFriction(): number | undefined { return this.friction }
	public getSize(): Vector2D { return { x: this.size, y: this.size } }
	public getDeadTimer(): number { return this.dead }
	public addHP(hp: number): void { this.hp += hp }
	public getHP(): number { return this.hp }
	public setColor(color: string): void { this.color = color }
	public getColor(): string { return this.color }
	public setPlayerIcon(icon: string): void { this.playericon = icon; }
	public setSize(size: number): void { this.size = size; }
	public getShape(): "circle" { return this.shape }

	public onCollision({ entity: _ }: { entity: IPhysics; }): void { }
	public getTeam(): string[] {
		return this.team
	}
}

