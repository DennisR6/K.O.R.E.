import type { EntityManager } from "../entity/EntityManager";
import type { Structure } from "../structures/structures";
import { PhysicsSystem } from "../systems/PhysicsSystem";
import type { IGameContext } from "../systems/types";
import { GameState, type ISimulator } from "./types";

export class Simulator implements ISimulator {

	constructor() { }
	/**
	 * Führt einen Physik-Schritt aus
	 */
	public step(physics: PhysicsSystem, dt: number, entities: EntityManager, structures: Structure[]): void {
		const mockContext: IGameContext = {
			state: GameState.SIMULATING,
			entities,
			structures,
		} as IGameContext;

		physics.update(mockContext, dt, physics.strategy.getFriction());
	}

	public isStatic(entities: EntityManager): boolean {
		const epsilon = 0.1;
		return entities.getEntities().every(e => {
			const vel = e.getVel();
			return Math.abs(vel.x) < epsilon && Math.abs(vel.y) < epsilon;
		});
	}
}
