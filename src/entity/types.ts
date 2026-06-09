import type { UUID } from "node:crypto";
import type { SHAPE, Vector2D } from "../physics/physics";
import type { SettingsEntity } from "../settings/settings";
import type { AssetList } from "../assetManager/assets/assetRegistry";

/**
 * Ein EntitySnapshot repräsentiert den Zustand einer Entity zu einem spezifischen Zeitpunkt.
 * 
 * Snapshots sind essenziell für:
 * 1. **Simulation**: Speichern des Endergebnisses eines Spielzugs im `TurnPacket`.
 * 2. **Interpolation**: Berechnung von Zwischenpositionen während des Playbacks.
 * 3. **Netzwerk**: Übertragung der minimal notwendigen Daten vom Server zum Client.
 */
export interface EntitySnapshot {
	/** Die eindeutige ID der Entity, um sie im EntityManager wiederzufinden. */
	id: string;

	/** Die X-Position in Welt-Einheiten zum Zeitpunkt des Snapshots. */
	x: number;
	/** Die Y-Position in Welt-Einheiten zum Zeitpunkt des Snapshots. */
	y: number;

	/** Die Geschwindigkeit auf der X-Achse (Velocity X). Wichtig für Bewegungsunschärfe oder Vorhersagen. */
	vx: number;
	/** Die Geschwindigkeit auf der Y-Achse (Velocity Y). */
	vy: number;

	/** 
	 * Optionale Rotation in Radiant oder Grad. 
	 * Nützlich für asymmetrische Objekte oder visuelle Effekte. 
	 */
	rotation?: number;

	/** 
	 * Statusflag: Gibt an, ob das Objekt zum Zeitpunkt des Snapshots bereits ruhte. 
	 * Hilft dem Renderer, Berechnungen für ruhende Objekte zu überspringen.
	 */
	isStatic?: boolean;
}
export interface IKillable {
	setHP(hp: number): void;
	getHP(): number;
	addHP(hp: number): void
	isDead(): boolean
}
export interface EngineSettingsEntity extends SettingsEntity {
	id: UUID;
	position: Vector2D;
	velocity: Vector2D;
	hp: number;
	bouncyness: number;
	mass: number;
	size: number;
	friction: number | undefined;
	team: number[];
	color: string;
	playericon: AssetList;
	shape: SHAPE.CIRCLE
	hoop: AssetList
	isPhysicsEnabled: boolean
	isDead: boolean
}	
