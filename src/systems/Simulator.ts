import type { EntityManager } from "../entity/EntityManager.js";
import { PhysicsSystem } from "./PhysicsSystem.js";
import type { IGameContext, ISimulator } from "./types.js";
import { GameState } from "../engine/types.js";

/**
 * Der Simulator berechnet Spielzustände unabhängig von der Anzeige.
 * 
 * Er wird genutzt, um einen Spielzug direkt nach dem Schuss komplett 
 * durchzurechnen ("Vorspulen"), damit das Ergebnis feststeht, bevor 
 * die Animation (Playback) beginnt.
 */
export class Simulator implements ISimulator {
	private physics: PhysicsSystem

	constructor(physics: PhysicsSystem) { this.physics = physics }

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

	ticker(ctx: IGameContext, dt: number, friction: number): void {
		if (ctx.state !== GameState.SIMULATING) return
		// Wir rufen direkt den Taktgeber der Physik auf
		this.physics.ticker(ctx, dt, friction ?? this.physics.strategy.getFriction());
	}
}
