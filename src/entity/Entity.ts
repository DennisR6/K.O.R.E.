import type { IDrawer, ITicker } from "../engine/RenderContext";
import type { IPhysicsCircle, Vector2D } from "../physics/physics";
import type { IKillable } from "./types";

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
export interface IEntity extends IDrawer, ITicker, IPhysicsCircle, IKillable {

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

	/**
	 * @returns {Vector2D} Gibt die größe (Radius) des Players.
	 */
	getSize(): Vector2D;
	setColor(color: string): void;

	setPlayerIcon(icon: string): void;
	setSize(size: number): void;
	getColor(): string;
}
