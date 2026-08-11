import { PARTICIPATION_EFFECT_IDS, PARTICIPATION_SET_DRAWING_EFFECT_ID, PARTICIPATION_SET_PHYSICS_EFFECT_ID } from "@coffeemakerstudio/roast";
import type { EngineEffectSettings } from "@coffeemakerstudio/roast";
import type { IGameContext, IPredefinedEffectSystem, ResolvedPredefinedTarget, SystemSettings } from "./types.js";

/** Trusted interpreter for the explicitly supported physics/drawing flags. */
export class ParticipationSystem implements IPredefinedEffectSystem {
	public readonly systemId = "core.participation";
	public toSettings(): SystemSettings { return { systemId: this.systemId, schemaVersion: 1, state: {} }; }
	public ticker(_ctx: IGameContext, _dt: number, _friction: number): void { }
	public acceptsEffect(effectId: string): boolean { return PARTICIPATION_EFFECT_IDS.includes(effectId as typeof PARTICIPATION_EFFECT_IDS[number]); }
	public applyEffect(_ctx: IGameContext, effect: EngineEffectSettings, target: ResolvedPredefinedTarget): void {
		if (target.type !== "entity" && target.type !== "structure") throw new Error("Participation effect requires an entity or structure target");
		const payload = effect.typeValue;
		if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Participation payload must be an object");
		const value = payload as Record<string, unknown>;
		if (Object.keys(value).length !== 1 || typeof value.enabled !== "boolean") throw new Error("Participation payload is invalid");
		if (effect.type === PARTICIPATION_SET_PHYSICS_EFFECT_ID) target.type === "entity" ? target.entity.setPhysicsEnabled(value.enabled) : target.structure.setPhysicsEnabled(value.enabled);
		else if (effect.type === PARTICIPATION_SET_DRAWING_EFFECT_ID) target.type === "entity" ? target.entity.setDrawingEnabled(value.enabled) : target.structure.setDrawingEnabled(value.enabled);
		else throw new Error(`Unknown participation effect '${effect.type}'`);
	}
}
