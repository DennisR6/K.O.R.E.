import { EntityManager } from "../entity/EntityManager.js";
import type { PlayerSettings } from "../entity/types.js";
import type { PhysicsStrategy } from "../physics/physics.js";
import { GameSettings } from "../settings/settings.js";
import type { IGameContext, ISystem } from "../systems/types.js";
import type { RuleState } from "../rules/types.js";
import type { MatchResult } from "../rules/types.js";

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
	finalState: PlayerSettings[];
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
 * das ist auch gleichzeitig die Dokumentation für den Ablaufplan in der Engine:
 * alles was untereinander ist läuft nacheinander ab und was nebeneinander ist ist quasi eine abzweigung
 * bsp.
 * starting ist immer der anfang
 * dann wird "immer" auf waiting for players gewechselt um auf die restlichen spieler zu warten
 * lokal wird da einfach der state durchgereicht.
 * danach wird entschieden, ob du oder der gegner dran ist und dementsprechend dann YOUR_TURN oder OPPONENTS_TURN gesetzt.
 * wenn der INPUT gemacht worden ist, dann wird TURN_DONE aufgerufen und 
 */
export const enum GameState {
	Starting = "GameState.Starting",
	Waiting_for_Players = "GameState.Waiting_for_Players",
	ChooseTeam = "GameState.ChooseTeam",
	Your_turn = "GameState.Your_turn",
	Opponents_turn = "GameState.Opponents_turn",
	Turn_done = "GameState.Turn_done",
	Round_done = "GameState.Round_done",
	Simulating = "GameState.Simulating",
	Simulating_done = "GameState.Simulating_done",
	Playing = "GameState.Playing",
	Playing_done = "GameState.Playing_done",
	Waiting_for_server = "GameState.Waiting_for_server",
	Game_over = "GameState.Game_over",
	Goal_scored = "GameState.Goal_scored",
	Error = "GameState.Error",
};

export function getEngineStateName(state: GameState) {
	switch (state) {
		case GameState.Starting: return "Starting"
		case GameState.Waiting_for_Players: return "Waiting for Players"
		case GameState.ChooseTeam: return "ChooseTeam"
		case GameState.Your_turn: return "Your Turn"
		case GameState.Opponents_turn: return "Opponents Turn"
		case GameState.Turn_done: return "Turn done"
		case GameState.Round_done: return "Round done"
		case GameState.Simulating: return "Simulating"
		case GameState.Simulating_done: return "Simulating done"
		case GameState.Playing: return "Playing"
		case GameState.Playing_done: return "Playing done"
		case GameState.Waiting_for_server: return "Waiting for_server"
		case GameState.Game_over: return "Game over"
		case GameState.Goal_scored: return "GOAL SCORED"
		case GameState.Error: return "Engine is in an ErrorState"
		default: return `GameState ${state} not implemented`
	}
}

/** Bequemlichkeits-Typ für alle möglichen GameStates. */
export type GameStateType = keyof typeof GameState;

/**
 * Definiert die Interaktionsmöglichkeiten mit der Maus.
 */
export interface IMouse {
	handleMousePressed(): void;
	updateMouse(x: number, y: number): void;
	handleMouseReleased(): void;
	handleMouseWheel(event: WheelEvent): void;
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
	activeTeam: number
	ruleState: RuleState
	itemDrawState?: ItemDrawState
	matchResult?: MatchResult
	players: PlayerSettings[];
	// MapBoundarySettings: EngineSettingsMapBoundary[];
}

/** Serializable progress of the seeded item-draw sequence. */
export interface ItemDrawState {
	randomState: number
}
