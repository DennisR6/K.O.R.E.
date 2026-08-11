import type { EntityManager } from "../entity/EntityManager.js";
import type { IGameContext, ISerializableSystem, ISimulator, SystemSettings } from "./types.js";
import type { PhysicsSystem } from "./PhysicsSystem.js";
import { GameState } from "../kore/runtime/types.js";
import { isPhysicsParticipant } from "../physics/physics.js";

/**
 * Der Simulator berechnet Spielzustände unabhängig von der Anzeige.
 * 
 * Er wird genutzt, um einen Spielzug direkt nach dem Schuss komplett 
 * durchzurechnen ("Vorspulen"), damit das Ergebnis feststeht, bevor 
 * die Animation (Playback) beginnt.
 */
export class Simulator implements ISimulator, ISerializableSystem<SystemSettings> {
	public readonly systemId = "core.simulator";
	private physics: PhysicsSystem

	constructor(physics: PhysicsSystem) { this.physics = physics }
	public toSettings(): SystemSettings { return { systemId: this.systemId, schemaVersion: 1, state: {} }; }

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

		return entities.getEntities().filter(isPhysicsParticipant).every(e => {
			const vel = e.getVel();
			return Math.abs(vel.x) < epsilon && Math.abs(vel.y) < epsilon;
		});
	}

	ticker(ctx: IGameContext, dt: number, friction: number): void {
		if (ctx.state != GameState.Simulating) return
		this.physics.ticker(ctx, dt, friction)
	}
}
