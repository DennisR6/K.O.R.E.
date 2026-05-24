import type { GameStateType, TurnPacket } from "../engine/types.js";
import type { EntityManager } from "../entity/EntityManager.js";
import type { IStructure } from "../structures/structures.js";

/**
 * Der IGameContext ist das "Gedächtnis" eines Frames.
 * 
 * Er bündelt alle Informationen, die ein System benötigt, um eine Entscheidung zu treffen.
 * Statt 20 Parameter an jede Funktion zu übergeben, reichen wir dieses eine Objekt herum.
 */
export interface IGameContext {
	/** Zugriff auf alle dynamischen Objekte (Spieler, Pucks). */
	entities: EntityManager;
	/** Liste aller statischen Hindernisse auf der Map. */
	structures: IStructure[];
	/** Der aktuelle globale Spielzustand (z.B. "WAITING", "RUNNING", "GOAL"). */
	state: GameStateType;
	/** Die globalen Konfigurationen (Physik-Werte, Timer-Limits, etc.). */
	// settings: GameSettings;
	dt: number;
}

/**
 * Das Grundgerüst für jedes Modul der Engine.
 * 
 * Jede Logik-Komponente (Physik, KI, Rundensystem) muss dieses Interface erfüllen,
 * damit der GameLoop sie einheitlich aufrufen kann.
 */
export interface ISystem {
	/**
	 * Wird in jedem Frame aufgerufen, um die Logik zu berechnen.
	 * @param ctx - Der aktuelle Spielkontext (Datenquelle).
	 * @param dt - DeltaTime (Zeit seit dem letzten Frame).
	 * @param friction - Die aktuell wirkende globale Reibung.
	 */
	ticker(ctx: IGameContext, dt: number, friction: number): void;
}

/**
 * Spezialisiertes System für die Wiedergabe von Spielzügen.
 * 
 * Erweitert ISystem um die Steuerung von TurnPackets (aufgezeichnete Daten).
 */
export interface IPlayback extends ISystem {
	/** Startet die Wiedergabe eines aufgezeichneten Zuges. */
	play(packet: TurnPacket): void;
	/** Stoppt die Wiedergabe sofort. */
	stop(): void;
	/** Gibt an, ob die Wiedergabe nach dem Ende automatisch neu startet. */
	isLooping(): boolean;
}

/**
 * Der ISimulator ist die "Rechen-Instanz" der Engine.
 * Er berechnet physikalische Zustände in der Zukunft, ohne sie grafisch anzuzeigen.
 */
export interface ISimulator extends ISystem {
	isStatic(entities: EntityManager): boolean;
}
