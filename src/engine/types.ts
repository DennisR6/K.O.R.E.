import { EntityManager } from "../entity/EntityManager";
import type { EntitySnapshot } from "../entity/types";
import type { PhysicsStrategy } from "../physics/physics";
import type { IGameContext, ISystem } from "../systems/types";

/**
 * Das TurnPacket ist das "Ergebnis-Paket" eines Spielzugs.
 * Es enthält alles, was passiert IST, damit es später 
 * exakt so abgespielt werden kann.
 */
export interface TurnPacket {
	/** Wer hat den Schuss abgegeben? */
	actorId: string | number;
	/** Mit welchen Werten wurde geschossen? */
	input: { angle: number; power: number };
	/** Wie viele Frames dauert die Animation insgesamt? */
	durationFrames: number;
	/** Der Zustand aller Objekte NACH dem Schuss (Endpositionen). */
	finalState: EntitySnapshot[];
}


/**
 * Das Interface für die Kommunikation von Spielzügen.
 * Entkoppelt die Eingabe (Maus/Tastatur) von der Verarbeitung (Netzwerk/Lokal).
 */
export interface IInputEmitter {
	sendShot(actorId: string | number, angle: number, power: number): void;
}

/**
 * Hilfsfunktion zur Erstellung eines validen Spiel-Kontexts.
 * @param overrides - Erlaubt das gezielte Überschreiben von Standardwerten (z.B. für Tests).
 * @returns Ein vollständiges IGameContext Objekt.
 */
export const createDefaultContext = (overrides: Partial<IGameContext> = {}): IGameContext => {
	return {
		state: GameState.YOUR_TURN,
		entities: new EntityManager([]),
		structures: [],
		settings: { id: "", screenResolution: { x: 16, y: 9 } },
		dt: overrides.dt ?? 1,
		...overrides
	};
}

/**
 * Definiert die Phasen des Game-Lifecycles.
 * 
 * @important 
 * Damit die Engine korrekt arbeitet, müssen folgende Systeme aktiv sein:
 * - **Simulator**: Berechnet die Physik in der SIMULATING Phase.
 * - **PlaybackSystem**: Steuert die Visualisierung in der PLAYING Phase.
 * - **RoundHandler**: Regelt den Übergang von PLAYING_DONE zu YOUR_TURN / OPPONENTS_TURN.
 * @example
 * if (context.state === GameState.YOUR_TURN) { 
 *    // Erlaube Maus-Interaktion 
 * }
 */
export const GameState = {
	/** Default-Status vor der Initialisierung */
	STARTING: "STARTING",
	/** Wartebereich für Multiplayer-Verbindungen */
	WAITING_FOR_PLAYERS: "WAITING_FOR_PLAYERS",
	/** Der lokale Spieler ist am Zug */
	YOUR_TURN: "YOUR_TURN",
	/** Der Gegner ist am Zug (Remote oder KI) */
	OPPONENTS_TURN: "OPPONENTS_TURN",
	/** Physik wird im Hintergrund vorausberechnet (Simulator aktiv) */
	SIMULATING: "SIMULATING",
	/** Berechnung abgeschlossen, bereit für die Darstellung */
	SIMULATING_DONE: "SIMULATING_DONE",
	/** Die berechneten Daten werden animiert dargestellt (Playback aktiv) */
	PLAYING: "PLAYING",
	/** Animation beendet, Zeit für die nächste Phase (RoundHandler übernimmt) */
	PLAYING_DONE: "PLAYING_DONE",

	/** Das ist aktuell noch nicht implementiert */
	GOAL_SCORED: "GOAL_SCORED",
	TURN_DONE: "TURN_DONE",
	GAME_OVER: "GAME_OVER",
} as const;

/** Bequemlichkeits-Typ für alle möglichen GameStates. */
export type GameStateType = keyof typeof GameState;

/**
 * Definiert die Interaktionsmöglichkeiten mit der Maus.
 */
export interface IMouse {
	handleMousePressed(mouseX: number, mouseY: number): void;
	updateMouse(mouseX: number, mouseY: number): void;
	handleMouseReleased(): void;
}

/**
 * Alles, was der Handler zum Überleben braucht.
 * Wenn du die Engine startest, steckst du hier deine 
 * konkreten Implementierungen (P5Renderer, SocketEmitter, etc.) hinein.
 */
export type HandlerDependencies = {
	context: Partial<IGameContext>;           // Der aktuelle Welt-Zustand
	entityManager: EntityManager;    // Die Verwaltung der Pucks
	physicsStrategy: PhysicsStrategy;// Die Regeln (Eis, Rasen, Sand?)
	inputEmitter: IInputEmitter;     // Wo geht der Schuss hin?
	systems: ISystem[];              // Zusätzliche Logik-Module
	dt: number; 					 // Das ist die Tickzeit der Engine
};

/**
 * Das universelle Format für einen Spiel-Input.
 */
export type IInput = { actorId: string | number, angle: number, power: number }
