import { EntityManager } from "../entity/EntityManager.js";
import type { EntitySnapshot } from "../entity/types.js";
import type { PhysicsStrategy, Vector2D } from "../physics/physics.js";
import { GameSettings } from "../settings/settings.js";
import type { IGameContext, ISystem } from "../systems/types.js";

/**
 * Das TurnPacket ist das "Ergebnis-Paket" eines Spielzugs.
 * Es enthält alles, was passiert IST, damit es später 
 * exakt so abgespielt werden kann.
 */
export interface TurnPacket {
	/** Wer hat den Schuss abgegeben? */
	actorId: string;
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
	sendShot(actorId: string, angle: number, power: number): void;
}

/**
 * Hilfsfunktion zur Erstellung eines validen Spiel-Kontexts.
 * @param overrides - Erlaubt das gezielte Überschreiben von Standardwerten (z.B. für Tests).
 * @returns Ein vollständiges IGameContext Objekt.
 */
// export const createDefaultContext = (overrides: Partial<IGameContext> = {}): IGameContext => {
// 	return {
// 		state: GameState.YOUR_TURN,
// 		entities: new EntityManager([]),
// 		structures: [],
// 		settings: { id: "", screenResolution: { x: 16, y: 9 } },
// 		dt: overrides.dt ?? 1,
// 		...overrides
// 	};
// }

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
export const enum GameState {
	/** Default-Status vor der Initialisierung */
	STARTING,
	/** Wartebereich für Multiplayer-Verbindungen */
	WAITING_FOR_PLAYERS,
	/** Der lokale Spieler ist am Zug */
	YOUR_TURN,
	/** Der Gegner ist am Zug (Remote oder KI) */
	OPPONENTS_TURN,
	/** Physik wird im Hintergrund vorausberechnet (Simulator aktiv) */
	SIMULATING,
	/** Berechnung abgeschlossen, bereit für die Darstellung */
	SIMULATING_DONE,
	/** Die berechneten Daten werden animiert dargestellt (Playback aktiv) */
	PLAYING,
	/** Animation beendet, Zeit für die nächste Phase (RoundHandler übernimmt) */
	PLAYING_DONE,

	/** Das ist aktuell noch nicht implementiert */
	GOAL_SCORED,
	TURN_DONE,
	GAME_OVER,
	ITEM_DRAW,
	ITEM_END,
	WAITING_FOR_SERVER,
};

export function getEngineStateName(state: GameState) {
	switch (state) {
		case (GameState.STARTING): return "STARTING"
		case (GameState.WAITING_FOR_PLAYERS): return "WAITING_FOR_PLAYERS"
		case (GameState.YOUR_TURN): return "YOUR_TURN"
		case (GameState.OPPONENTS_TURN): return "OPPONENTS_TURN"
		case (GameState.SIMULATING): return "SIMULATING"
		case (GameState.SIMULATING_DONE): return "SIMULATING_DONE"
		case (GameState.PLAYING): return "PLAYING"
		case (GameState.PLAYING_DONE): return "PLAYING_DONE"
		case (GameState.GOAL_SCORED): return "GOAL_SCORED"
		case (GameState.TURN_DONE): return "TURN_DONE"
		case (GameState.GAME_OVER): return "GAME_OVER"
		case (GameState.ITEM_DRAW): return "ITEM_DRAW"
		case (GameState.ITEM_END): return "ITEM_END"
		case (GameState.WAITING_FOR_SERVER): return "Waiting for Server"
		default: return "NOT IMPLEMENTED STATE"
	}
}

/** Bequemlichkeits-Typ für alle möglichen GameStates. */
export type GameStateType = keyof typeof GameState;

/**
 * Definiert die Interaktionsmöglichkeiten mit der Maus.
 */
export interface IMouse {
	handleMousePressed(mouseX: number, mouseY: number): void;
	updateMouse(mouseX: number, mouseY: number): void;
	handleMouseReleased(cb?: (actorId: string, angle: number, power: number) => void): void;
	handleMouseWheel(event: WheelEvent): void;
	setCurrentMousePosition(pos: Vector2D): void;
	getCurrentMousePosition(): Vector2D;
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
export type IInput = { actorId: string, angle: number, power: number }
export interface IMouseHandler extends IMouse, ISystem { }
export interface IU8Serialize<T> {
	serialize(): Uint8Array
	deserialize(input: Uint8Array): T
}

export interface IJSONSerialize {
	serialize(): string
	deserialize(input: string): void
}

export interface ISettingsSerialize<T> {
	toSettings(): T
}

export interface EngineSettings extends GameSettings {
	state: GameState
	turnNumber: number
}
