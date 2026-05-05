import type { IDrawer, ITicker, RenderContext } from "../engine/RenderContext";
import type { IPhysics, IPhysicsCircle, Vector2D } from "../physics/physics";
import { GameLogger } from "../utils/log";

/**
 * Das Basis-Interface für alle Spielobjekte (Entities).
 * 
 * Jedes Objekt, das in der Spielwelt existieren soll (Spieler, Pucks, Hindernisse),
 * muss dieses Interface implementieren. Es vereint drei Kernaspekte:
 * 
 * 1. **Grafik (IDrawer)**: Das Objekt weiß, wie es sich auf der Leinwand zeichnet.
 * 2. **Logik (ITicker)**: Das Objekt reagiert auf den Lauf der Zeit (Bewegung).
 * 3. **Physik (IPhysicsCircle)**: Das Objekt hat eine physische Form für Kollisionen.
 */
export interface IEntity extends IDrawer, ITicker, IPhysicsCircle {

	/**
	 * Gibt die aktuelle Position der Entity zurück.
	 * @returns {Vector2D} Ein Vektor mit den aktuellen x- und y-Koordinaten in Welt-Einheiten.
	 */
	getPos(): Vector2D;

	/**
	 * Die eindeutige Identifikationsnummer oder der Name der Entity.
	 * Wichtig für die Synchronisation zwischen Client, Server und Simulator.
	 * @returns {number | string} Die ID der Entity.
	 */
	getId(): number | string;
}

/**
 * Das Konfigurations-Interface für einen Spieler.
 * 
 * Es dient als Vorlage (Data Transfer Object), um einen Spieler mit 
 * individuellen Eigenschaften wie Teamzugehörigkeit, Farbe oder Icons zu erstellen.
 * Alle Eigenschaften außer den Koordinaten sind optional, um maximale Flexibilität
 * beim Erstellen von Gast-Accounts oder Standard-Entities zu bieten.
 */
export interface IPlayer {
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
	private size: number;
	/** Individuelle Reibung (überschreibt bei Bedarf die globale Reibung). */
	private friction: number | undefined;

	private team: string[];
	private color: string;
	private playericon: string;
	private shape: "circle"

	constructor() {
		// Standardwerte für ein leeres Objekt
		this.id = 0
		this.position = { x: 0, y: 0 }
		this.team = []
		this.color = "red"
		this.playericon = ""
		this.shape = "circle"
		this.velocity = { x: 0, y: 0 } as Vector2D
		this.bouncyness = 0.1
		this.friction = undefined;
		this.size = 20;
		this.mass = 1
	}


	/**
		 * Initialisiert den Spieler mit echten Daten.
		 * Berechnet die Position so, dass der Ankerpunkt in der Mitte liegt.
		 * @param player - Die Konfigurationsdaten (IPlayer).
		 */
	public new(player: IPlayer) {
		this.id = player.id || crypto.randomUUID();
		this.position = {
			x: player.x - (player.size ?? 20),
			y: player.y - (player.size ?? 20)
		};

		this.velocity = {
			x: (player as any).vx ?? 0,
			y: (player as any).vy ?? 0
		};
		this.team = player.team ?? this.team;
		this.color = player.color ?? this.color;
		this.playericon = player.playericon ?? this.playericon;
		this.size = player.size ?? 20;
		this.shape = "circle";
		return this;
	}

	/**
		 * Zeichnet den Spieler und einen Richtungsvektor.
		 * Der Richtungsvektor hilft dem Spieler zu sehen, wohin sich der Puck bewegt.
		 */
	public draw(ctx: RenderContext): void {
		ctx.setFillColor(this.color);
		const nextX = this.position.x + this.velocity.x * 3;
		const nextY = this.position.y + this.velocity.y * 3;
		if (this.velocity.x !== 0 || this.velocity.y !== 0) {
			ctx.line(this.getPos().x, this.getPos().y, nextX, nextY)
		}
		ctx.beginClip()
		ctx.drawCircle(this.position.x + this.size, this.position.y + + this.size, this.size * 2);
		ctx.endClip()
		ctx.drawImage(
			this.playericon, this.getPos().x - this.size,
			this.getPos().y - this.size,
			this.size * 2,
			this.size * 2,
			100, 100, 100 + 400, 100 + 512
		)
	}

	/**
		 * Integriert die Geschwindigkeit in die Position basierend auf der vergangenen Zeit.
		 * @param deltaTime - Zeit seit dem letzten Physik-Schritt.
		 */
	public tick(deltaTime: number, _globalFriction: number) {
		this.position.x += this.velocity.x * deltaTime;
		this.position.y += this.velocity.y * deltaTime;
	}


	/**
		 * Setzt eine neue Position und validiert diese gegen massive Abweichungen.
		 * Hilft dabei, "Teleportations-Bugs" im Netzwerk-Code zu finden.
		 */
	public getBounds(): { radius: number; } { return { radius: this.size } }

	public getVel() { return { x: this.velocity.x, y: this.velocity.y }; }

	public getBounceFactor(): number { return this.bouncyness }

	public setVel(v: { x: number, y: number }) {
		this.velocity.x = v.x;
		this.velocity.y = v.y;
	}
	public getMass(): number { return this.mass }

	public setMass(inertia: number): void { this.mass = Math.min(inertia, 1) }
	public setPos(pos: Vector2D): void {
		if (
			(this.position.x > pos.x * 1.1 || this.position.x < pos.x * 0.9) ||
			(this.position.y > pos.y * 1.1 || this.position.y < pos.y * 0.9)
		) {
			GameLogger.error("Position weicht massiv ab!");
		}
		this.position = { x: pos.x - this.size, y: pos.y - this.size }
	}

	public getPos(): Vector2D { return { x: this.position.x + this.size, y: this.position.y + this.size } }

	public onCollision({ entity: _ }: { entity: IPhysics; }): void { }

	public getFriction(): number | undefined { return this.friction }
	public setFriction(friction: number): void { this.friction = friction }
	public getId(): number | string { return this.id }
	public setId(id: string | number): void { this.id = id }
	public getShape(): "circle" { return this.shape }

	/**
		 * Aktiviert die Überwachung für Position und Geschwindigkeit.
		 * Jede Änderung an diesen Werten wird in der Konsole mit Stacktrace geloggt.
		 * Ein mächtiges Tool für das Debugging der Physik-Engine.
		 */
	public enableMutationTracking() {
		this.position = createTrackingProxy(this.position, "POSITION", this.id.toString());
		this.velocity = createTrackingProxy(this.velocity, "VELOCITY", this.id.toString());
	}
}

export function createTrackingProxy(target: any, label: string, entityId: string) {
	return new Proxy(target, {
		set(obj, prop, value) {
			// Wir ignorieren Änderungen von 0 auf 0, um Rauschen zu vermeiden
			if (obj[prop] === value) return true;

			console.warn(`[MUTATION] Entity ${entityId} | ${label}.${String(prop)}: ${obj[prop]} -> ${value}`);
			console.trace(); // Das zeigt uns die exakte Datei und Zeile des Übeltäters

			obj[prop] = value;
			return true;
		}
	});
}
