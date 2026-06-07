import type { EntityManager } from "../entity/EntityManager.js";
import type { ISimulator } from "./types.js";
import type { PhysicsStrategy } from "../physics/physics.js";

/**
 * Der Simulator berechnet Spielzustände unabhängig von der Anzeige.
 * 
 * Er wird genutzt, um einen Spielzug direkt nach dem Schuss komplett 
 * durchzurechnen ("Vorspulen"), damit das Ergebnis feststeht, bevor 
 * die Animation (Playback) beginnt.
 */
export class Simulator implements ISimulator {
	private physics: PhysicsStrategy

	constructor(physics: PhysicsStrategy) { this.physics = physics }

	/**
	 * Prüft, ob die Welt "eingeschlafen" ist.
	 * 
	 * Eine Simulation ist beendet, wenn sich kein Objekt mehr signifikant bewegt.
	 * 
	 * @param entities - Der EntityManager mit allen Objekten.
	 * @returns true, wenn alle Objekte (fast) stillstehen.
	 */
	public isStatic(entities: EntityManager): boolean {
		// Epsilon ist unser Toleranzwert. 
		// Alles unter 0.1 Pixel/Sekunde gilt als "stehend".
		const epsilon = 0.1;

		return entities.getEntities().every(e => {
			const vel = e.getVel();
			// Wir prüfen beide Achsen auf Stillstand
			return Math.abs(vel.x) < epsilon && Math.abs(vel.y) < epsilon;
		});
	}

	tick(dt: number, friction: number): void {
		this.physics.tick(dt, friction ?? this.physics.getFriction());
	}
}
