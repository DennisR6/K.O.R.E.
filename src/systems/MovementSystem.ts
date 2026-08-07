import { EffectType } from "../effects/types.js";
import { createMovementState } from "../engine/sdk/entityState.js";
import type { ISerializableSystem, IGameContext, SystemSettings } from "./types.js";

/** Applies persistent Movement effects before entity-local physics effects. */
export class MovementSystem implements ISerializableSystem<SystemSettings> {
	public readonly systemId = "core.movement";

	public preTick(ctx: IGameContext, dt: number): void {
		for (const entity of ctx.entities.getEntities()) {
			if (entity.isDead() || !entity.physicsEnabled()) continue;
			const settings = entity.toSettings();
			let movement = createMovementState({ velocity: entity.getVel(), angularVelocity: settings.angularVelocity, enabled: entity.physicsEnabled() });
			for (const effect of entity.getAlwaysEffects()) {
				if (effect.getType() !== EffectType.Movement) continue;
				effect.apply(entity, { x: movement.velocity.x, y: movement.velocity.y, deltaTime: dt, rotation: settings.rotation, drift: ctx.drift ?? 0, stopThreshold: ctx.physics.getStopThreshold() });
				movement = createMovementState({ velocity: entity.getVel(), angularVelocity: settings.angularVelocity, enabled: entity.physicsEnabled() });
			}
		}
	}

	public ticker(_ctx: IGameContext, _dt: number, _friction: number): void {}

	public toSettings(): SystemSettings {
		return { systemId: this.systemId, schemaVersion: 1, state: {} };
	}
}
