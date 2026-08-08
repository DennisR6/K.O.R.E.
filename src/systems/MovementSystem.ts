import { EffectType } from "../effects/types.js";
import { createMovementState } from "../engine/sdk/entityState.js";
import type { IGameContext, SystemSettings } from "./types.js";
import { createTickEvent, dispatchTriggeredEffects } from "../effects/triggerDispatcher.js";
import { MOVEMENT_COMMAND_EFFECT_IDS, MOVEMENT_ADD_VELOCITY_EFFECT_ID, MOVEMENT_APPLY_FORCE_FIELD_EFFECT_ID, MOVEMENT_APPLY_FORCE_TO_ENTITY_EFFECT_ID, MOVEMENT_SCALE_SPEED_EFFECT_ID, MOVEMENT_SET_VELOCITY_EFFECT_ID } from "../engine/sdk/movementCapability.js";
import { applyRadialVelocityDelta } from "../engine/sdk/movementForceField.js";
import type { EngineEffectSettings } from "../engine/sdk/effectRegistry.js";
import type { IPredefinedEffectSystem, ResolvedPredefinedTarget } from "./types.js";

/** Applies persistent Movement effects before entity-local physics effects. */
export class MovementSystem implements IPredefinedEffectSystem {
	public readonly systemId = "core.movement";

	public preTick(ctx: IGameContext, dt: number): void {
		for (const entity of ctx.entities.getEntities()) {
			if (entity.isDead() || !entity.physicsEnabled()) continue;
			const settings = entity.toSettings();
			let movement = createMovementState({ velocity: entity.getVel(), angularVelocity: settings.angularVelocity, enabled: entity.physicsEnabled() });
			const movementEffects = entity.getAlwaysEffects().filter(effect => effect.getType() === EffectType.Movement);
			if (movementEffects.length === 0) continue;
			dispatchTriggeredEffects({ effects: movementEffects, event: createTickEvent(String(entity.getId()), dt), apply: effect => {
				effect.apply(entity, { x: movement.velocity.x, y: movement.velocity.y, deltaTime: dt, rotation: settings.rotation, drift: ctx.drift ?? 0, stopThreshold: ctx.physics.getStopThreshold() });
				movement = createMovementState({ velocity: entity.getVel(), angularVelocity: settings.angularVelocity, enabled: entity.physicsEnabled() });
			} });
		}
	}

	public ticker(_ctx: IGameContext, _dt: number, _friction: number): void {}
	public acceptsEffect(effectId: string): boolean { return MOVEMENT_COMMAND_EFFECT_IDS.includes(effectId as typeof MOVEMENT_COMMAND_EFFECT_IDS[number]); }
	public applyEffect(_ctx: IGameContext, effect: EngineEffectSettings, target: ResolvedPredefinedTarget): void {
		if (effect.type === MOVEMENT_APPLY_FORCE_FIELD_EFFECT_ID) {
			if (target.type !== "position") throw new Error("Movement force field requires a position target");
			const payload = effect.typeValue as Record<string, unknown>;
			if (payload.mode !== "attract" && payload.mode !== "repel" || typeof payload.force !== "number" || !Number.isFinite(payload.force) || payload.force < 0 || typeof payload.range !== "number" || !Number.isFinite(payload.range) || payload.range <= 0) throw new Error("Movement force field payload is invalid");
			for (const entity of _ctx.entities.getEntities()) {
				if (entity.isDead() || !entity.physicsEnabled()) continue;
				entity.setVel(applyRadialVelocityDelta(entity.getVel(), target.position, entity.getPos(), { mode: payload.mode, force: payload.force, range: payload.range }));
			}
			return;
		}
		if (effect.type === MOVEMENT_APPLY_FORCE_TO_ENTITY_EFFECT_ID) {
			if (target.type !== "entity") throw new Error("Movement entity force requires an entity target");
			if (!target.entity.physicsEnabled()) throw new Error(`Movement target '${target.entity.getId()}' is inactive`);
			const payload = effect.typeValue as Record<string, unknown>;
			const origin = payload.origin as Record<string, unknown>;
			if (!origin || typeof origin.x !== "number" || !Number.isFinite(origin.x) || typeof origin.y !== "number" || !Number.isFinite(origin.y) || payload.mode !== "attract" && payload.mode !== "repel" || typeof payload.force !== "number" || !Number.isFinite(payload.force) || payload.force < 0 || typeof payload.range !== "number" || !Number.isFinite(payload.range) || payload.range <= 0) throw new Error("Movement entity force payload is invalid");
			target.entity.setVel(applyRadialVelocityDelta(target.entity.getVel(), { x: origin.x, y: origin.y }, target.entity.getPos(), { mode: payload.mode, force: payload.force, range: payload.range }));
			return;
		}
		if (target.type !== "entity") throw new Error("Movement effect requires an entity target");
		if (!target.entity.physicsEnabled()) throw new Error(`Movement target '${target.entity.getId()}' is inactive`);
		const payload = effect.typeValue;
		if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Movement command requires an object payload");
		const value = payload as Record<string, unknown>;
		if (effect.type === MOVEMENT_SET_VELOCITY_EFFECT_ID) {
			if (typeof value.x !== "number" || !Number.isFinite(value.x) || typeof value.y !== "number" || !Number.isFinite(value.y) || Object.keys(value).length !== 2) throw new Error("Movement set-velocity payload is invalid");
			target.entity.setVel({ x: value.x, y: value.y });
			return;
		}
		if (effect.type === MOVEMENT_ADD_VELOCITY_EFFECT_ID) {
			if (typeof value.x !== "number" || !Number.isFinite(value.x) || typeof value.y !== "number" || !Number.isFinite(value.y) || Object.keys(value).length !== 2) throw new Error("Movement add-velocity payload is invalid");
			const velocity = target.entity.getVel();
			target.entity.setVel({ x: velocity.x + value.x, y: velocity.y + value.y });
			return;
		}
		if (effect.type === MOVEMENT_SCALE_SPEED_EFFECT_ID) {
			if (typeof value.factor !== "number" || !Number.isFinite(value.factor) || value.factor < 0 || Object.keys(value).length !== 1) throw new Error("Movement scale-speed payload is invalid");
			const velocity = target.entity.getVel();
			target.entity.setVel({ x: velocity.x * value.factor, y: velocity.y * value.factor });
			return;
		}
		throw new Error(`Unknown movement effect '${effect.type}'`);
	}

	public toSettings(): SystemSettings {
		return { systemId: this.systemId, schemaVersion: 1, state: {} };
	}
}
