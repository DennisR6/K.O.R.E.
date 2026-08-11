import type { EngineMovementState, EngineTransformState } from "@coffeemakerstudio/roast";
import { validateMovementState, validateTransformState } from "@coffeemakerstudio/roast";
import { Player } from "./Player.js";

export interface PlayerEngineState {
	transform: EngineTransformState;
	movement: EngineMovementState;
}

/** Internal adapter; runtime Player remains outside all public SDK contracts. */
export function playerToEngineState(player: Player): PlayerEngineState {
	return {
		transform: { schemaVersion: 1, position: player.getPos(), rotation: player.getRotation() },
		movement: { schemaVersion: 1, velocity: player.getVel(), angularVelocity: player.getAngularVelocity(), enabled: player.physicsEnabled() },
	};
}

/** Applies detached generic state through the runtime Player mutation boundary. */
export function applyEngineStateToPlayer(player: Player, state: PlayerEngineState): void {
	validateTransformState(state.transform);
	validateMovementState(state.movement);
	player.setPos(state.transform.position);
	player.setRotation(state.transform.rotation);
	player.setVel(state.movement.velocity);
	player.setAngularVelocity(state.movement.angularVelocity);
	player.setPhysicsEnabled(state.movement.enabled);
}
