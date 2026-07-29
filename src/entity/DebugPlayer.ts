import { Player } from "./Player.js";
import type { PlayerSettings } from "./types.js";

/**
 * Eine spezialisierte Player-Klasse für Debugging-Zwecke.
 * 
 * Der TrackerPlayer verhält sich exakt wie ein normaler Spieler, 
 * kann aber bei Bedarf jeden Schreibzugriff auf Position und 
 * Geschwindigkeit protokollieren.
 * 
 * Einsatz: 
 * Tausche in der Initialisierung `new Player()` gegen `new TrackerPlayer()` aus,
 * um "Geisterbewegungen" oder fehlerhafte Physik-Sprünge zu finden.
 */
export class DebugPlayer extends Player {
	/** Status, ob das Logging aktuell aktiv ist. */
	private trackingActive: boolean = false;

	constructor(config: PlayerSettings) {
		super(config);
	}

	/**
		 * Aktiviert oder deaktiviert das Echtzeit-Tracking.
		 * @param state - Wenn true, wird jede Änderung via console.trace() geloggt.
		 */
	public setTracking(state: boolean) {
		this.trackingActive = state;
	}

	/**
		 * Überschreibt die Standard-Positionierung, um Änderungen zu überwachen.
		 * @override
		 */
	override setPos(pos: { x: number, y: number }): void {
		const { x, y } = super.getPos()
		if (
			(x > pos.x * 1.1 || x < pos.x * 0.9) ||
			(y > pos.y * 1.1 || y < pos.y * 0.9)
		) {
			console.error("Position weicht massiv ab!");
		}
		console.trace(this)
		super.setPos(pos);
	}

	/**
		 * Überschreibt die Geschwindigkeänderung, um Beschleunigungen zu überwachen.
		 * @override
		 */
	override setVel(vel: { x: number, y: number }): void {
		if (this.trackingActive) {
			console.info(`[TRACKER] setVel auf Entity ${this.getId().toString()}:`, vel);
			console.trace();
		}
		super.setVel(vel);
	}

	/**
		 * Überwacht den physikalischen Tick. 
		 * Besonders nützlich, um Objekte zu finden, die sich "plötzlich" vom Nullpunkt bewegen.
		 * @override
		 */
	override tick(dt: number, friction: number): void {
		const oldPos = { ...this.getPos() };
		super.tick(dt, friction);

		// Spezial-Check für den Nullpunkt-Bug
		if (this.trackingActive && oldPos.x === 0 && oldPos.y === 0 && this.getPos().x !== 0) {
			console.warn(`[TRACKER] Entity ${this.getId().toString()} bewegt sich vom Nullpunkt weg!`);
		}
	}
}
