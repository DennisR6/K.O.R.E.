import { Player } from "./player.ts";

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
export class TrackerPlayer extends Player {
	/** Status, ob das Logging aktuell aktiv ist. */
	private trackingActive: boolean = false;

	constructor(config?: any) {
		super();
		if (config) this.new(config);
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
		if (this.trackingActive) {
			console.log(`[TRACKER] setPos auf Entity ${this.getId().toString()}:`, pos);
			console.trace();
		}
		super.setPos(pos);
	}

	/**
		 * Überschreibt die Geschwindigkeitsänderung, um Beschleunigungen zu überwachen.
		 * @override
		 */
	override setVel(vel: { x: number, y: number }): void {
		if (this.trackingActive) {
			console.log(`[TRACKER] setVel auf Entity ${this.getId().toString()}:`, vel);
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
