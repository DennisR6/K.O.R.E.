import type { GameState, IInput, TurnPacket } from "../engine/types.js";
import type { EntityManager } from "../entity/EntityManager.js";
import type { PhysicsStrategy, Vector2D } from "../physics/physics.js";
import type { MatchResult } from "../rules/types.js";
import type { IStructure } from "../structures/types.js";
import type { ISettingsSerialize } from "../engine/types.js";
import type { SystemSettings as CanonicalSystemSettings } from "../engine/contracts/systemSettings.js";
import type { CounterState } from "../engine/contracts/counterState.js";
import type { EngineEffectSettings } from "../engine/sdk/effectRegistry.js";
import type { IEntity } from "../entity/Entity.js";
export type { SystemSettings } from "../engine/contracts/systemSettings.js";

export type ResolvedPredefinedTarget =
	| { type: "counter"; counter: CounterState }
	| { type: "entity"; entity: IEntity };

/** Versioned, data-only identity of a registered engine system. */
type SystemSettings = CanonicalSystemSettings;

/**
 * Serializable system contract. IDs are explicit protocol constants; runtime
 * constructor names are intentionally not part of persistence.
 */
export interface ISerializableSystem<T extends SystemSettings = SystemSettings> extends ISystem, ISettingsSerialize<T> {
	readonly systemId: string;
}

/** Trusted runtime interpreter contract for Engine-owned predefined systems. */
export interface IPredefinedEffectSystem extends ISerializableSystem {
	acceptsEffect(effectId: string): boolean;
	applyEffect(ctx: IGameContext, effect: EngineEffectSettings, target: ResolvedPredefinedTarget): void;
}

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
	state: GameState;
	/** Die globalen Konfigurationen (Physik-Werte, Timer-Limits, etc.). */
	// settings: GameSettings;
	dt: number;
	mouse: { turn: IInput | null }
	worldSize: Vector2D;
	physics: PhysicsStrategy
	currTurn: number
	activeTeam: number
	myTeamNumber: number
	/** Canonical world-level numeric facts; systems may interpret, never own, them. */
	counters: CounterState[]
	drift?: number
	/**
	 * Atomically completes the match with the given result.
	 *
	 * Transitions the game state to `GameState.Game_over` and stores the
	 * `MatchResult` in a single operation owned by the handler. The invariant
	 * `Game_over always implies a valid MatchResult` is enforced here: systems
	 * must never set `state` or the result independently.
	 */
	finishMatch(result: MatchResult): void;
}

/**
 * Das Grundgerüst für jedes Modul der Engine.
 * 
 * Jede Logik-Komponente (Physik, KI, Rundensystem) muss dieses Interface erfüllen,
 * damit der GameLoop sie einheitlich aufrufen kann.
 */
export interface ISystem {
	/** Optional deterministic phase before entity-local ticks. */
	preTick?(ctx: IGameContext, dt: number, friction: number): void;

	/**
	 * Wird in jedem Frame aufgerufen, um die Logik zu berechnen.
	 * @param ctx - Der aktuelle Spielkontext (Datenquelle).
	 * @param dt - DeltaTime (Zeit seit dem letzten Frame).
	 * @param friction - Die aktuell wirkende globale Reibung.
	 */
	ticker(ctx: IGameContext, dt: number, friction: number): void;

	/**
	 * Optionaler letzter Mutations-Schritt eines Ticks.
	 *
	 * Wird vom `GameHandler` NACH Systems, Map-Pickups, Struktur-Ticks und
	 * Post-Tickern aufgerufen. Systeme, die einen autoritativen Endzustand
	 * (z.B. Playback-Snapshots) anwenden, müssen dies hier tun, damit keine
	 * andere Gameplay-Mutation den finalen Zustand danach noch verändern kann.
	 */
	flush?(ctx: IGameContext): void;
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
export interface ISimulator {
	isStatic(entities: EntityManager): boolean;
}
