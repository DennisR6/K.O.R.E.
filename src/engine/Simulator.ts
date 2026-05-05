import type { EntityManager } from "../entity/EntityManager";
import type { Structure } from "../structures/structures";
import { PhysicsSystem } from "../systems/PhysicsSystem";
import type { IGameContext } from "../systems/types";
import { GameState, type ISimulator } from "./types";

/**
 * Der Simulator berechnet Spielzustände unabhängig von der Anzeige.
 * 
 * Er wird genutzt, um einen Spielzug direkt nach dem Schuss komplett 
 * durchzurechnen ("Vorspulen"), damit das Ergebnis feststeht, bevor 
 * die Animation (Playback) beginnt.
 */
export class Simulator implements ISimulator {

	constructor() { }

	/**
	 * Führt einen einzelnen isolierten Physik-Schritt aus.
	 * 
	 * Dabei wird ein "MockContext" erstellt: Wir tun so, als wäre die Welt 
	 * gerade im Zustand SIMULATING, damit die Physik-Engine weiß, dass sie 
	 * nur die nackte Mathematik berechnen soll, ohne UI-Effekte oder ähnliches.
	 * 
	 * @param physics - Das Physik-System, das die Regeln kennt.
	 * @param dt - Der Zeitschritt (Delta Time), der simuliert wird.
	 * @param entities - Die aktuelle Liste aller Spieler/Pucks.
	 * @param structures - Die Hindernisse auf dem Feld.
	 */
	public step(physics: PhysicsSystem, dt: number, entities: EntityManager, structures: Structure[]): void {
		const mockContext: IGameContext = {
			state: GameState.SIMULATING,
			entities,
			structures,
		} as IGameContext;

		// Wir rufen direkt den Taktgeber der Physik auf
		physics.tick(mockContext, dt, physics.strategy.getFriction());
	}

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
}
