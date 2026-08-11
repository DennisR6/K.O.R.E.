import { TRANSFORM_SET_POSITION_EFFECT_ID, TRANSFORM_SET_ROTATION_EFFECT_ID, TRANSFORM_SWAP_POSITION_EFFECT_ID } from "@coffeemakerstudio/roast";
import type { EngineEffectSettings } from "@coffeemakerstudio/roast";
import type { IGameContext, IPredefinedEffectSystem, ResolvedPredefinedTarget, SystemSettings } from "./types.js";

/** Trusted interpreter for generic absolute transform commands. */
export class TransformSystem implements IPredefinedEffectSystem {
	public readonly systemId = "core.transform";
	public toSettings(): SystemSettings { return { systemId: this.systemId, schemaVersion: 1, state: {} }; }
	public ticker(_ctx: IGameContext, _dt: number, _friction: number): void { }
	public acceptsEffect(effectId: string): boolean { return effectId === TRANSFORM_SET_POSITION_EFFECT_ID || effectId === TRANSFORM_SET_ROTATION_EFFECT_ID || effectId === TRANSFORM_SWAP_POSITION_EFFECT_ID; }
	public applyEffect(_ctx: IGameContext, effect: EngineEffectSettings, target: ResolvedPredefinedTarget): void {
		if (!effect.typeValue || typeof effect.typeValue !== "object" || Array.isArray(effect.typeValue)) throw new Error("Transform command requires an object payload");
		if (effect.type === TRANSFORM_SWAP_POSITION_EFFECT_ID) {
			if (target.type !== "entity") throw new Error("Transform swap position requires an entity target");
			const value = effect.typeValue as Record<string, unknown>;
			if (Object.keys(value).length !== 1 || typeof value.otherEntityId !== "string" || value.otherEntityId.length === 0) throw new Error("Transform swap position payload is invalid");
			if (value.otherEntityId === String(target.entity.getId())) throw new Error("Transform swap position requires distinct entities");
			const other = _ctx.entities.getEntityById(value.otherEntityId);
			if (!other) throw new Error(`Unknown transform swap entity '${value.otherEntityId}'`);
			const firstPosition = target.entity.getPos();
			const secondPosition = other.getPos();
			if (!finitePosition(firstPosition) || !finitePosition(secondPosition)) throw new Error("Transform swap positions must be finite");
			target.entity.setPos(secondPosition);
			other.setPos(firstPosition);
			return;
		}
		if (effect.type === TRANSFORM_SET_POSITION_EFFECT_ID) {
			const value = effect.typeValue as Record<string, unknown>;
			if (typeof value.x !== "number" || !Number.isFinite(value.x) || typeof value.y !== "number" || !Number.isFinite(value.y) || Object.keys(value).some(key => key !== "x" && key !== "y") || !Object.keys(value).includes("x") || !Object.keys(value).includes("y")) throw new Error("Transform position payload is invalid");
			const position = target.type === "structure" && target.positionOverride ? target.positionOverride : { x: value.x, y: value.y };
			if (target.type === "entity") target.entity.setPos(position);
			else if (target.type === "structure") target.structure.setPos(position);
			else throw new Error("Transform position requires an entity or structure target");
			return;
		}
		if (target.type !== "entity") throw new Error("Transform rotation requires an entity target");
		const value = effect.typeValue as Record<string, unknown>;
		if (typeof value.rotation !== "number" || !Number.isFinite(value.rotation) || Object.keys(value).length !== 1) throw new Error("Transform rotation payload is invalid");
		target.entity.setRotation(value.rotation);
	}
}

function finitePosition(value: { x: number; y: number }): boolean { return Number.isFinite(value.x) && Number.isFinite(value.y); }
