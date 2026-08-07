import type { EngineEffectSettings } from "../engine/sdk/effectRegistry.js";
import type { IGameContext, IPredefinedEffectSystem, ResolvedPredefinedTarget, ISystem } from "./types.js";

/** Dispatches one validated Engine command through exactly one trusted interpreter. */
export function dispatchPredefinedEffect(options: {
	ctx: IGameContext;
	systems: readonly ISystem[];
	effect: unknown;
}): void {
	const effect = validateEnvelope(options.effect);
	const interpreters = options.systems.filter(isPredefinedEffectSystem).filter(system => system.acceptsEffect(effect.type));
	if (interpreters.length === 0) throw new Error(`No predefined system accepts effect '${effect.type}'`);
	if (interpreters.length > 1) throw new Error(`Multiple predefined systems accept effect '${effect.type}'`);
	const target = resolveTarget(options.ctx, effect.target);
	interpreters[0]!.applyEffect(options.ctx, effect, target);
}

function resolveTarget(ctx: IGameContext, value: unknown): ResolvedPredefinedTarget {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Engine effect requires a target");
	const target = value as Record<string, unknown>;
	if (target.type === "counter") {
		if (typeof target.counterId !== "string" || target.counterId.length === 0) throw new Error("Counter target requires a non-empty counterId");
		const counter = ctx.counters.find(candidate => candidate.id === target.counterId);
		if (!counter) throw new Error(`Unknown counter target '${target.counterId}'`);
		return { type: "counter", counter };
	}
	if (target.type === "entity") {
		if (typeof target.entityId !== "string" || target.entityId.length === 0) throw new Error("Entity target requires a non-empty entityId");
		const entity = ctx.entities.getEntityById(target.entityId);
		if (!entity) throw new Error(`Unknown entity target '${target.entityId}'`);
		return { type: "entity", entity };
	}
	throw new Error(`Unknown predefined target type '${String(target.type)}'`);
}

function validateEnvelope(value: unknown): EngineEffectSettings {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed Engine effect");
	const effect = value as Partial<EngineEffectSettings>;
	if (typeof effect.type !== "string" || effect.type.length === 0) throw new Error("Engine effect requires a type");
	if (effect.schemaVersion !== 1) throw new Error("Unsupported Engine effect schema version");
	if (!("typeValue" in effect)) throw new Error("Engine effect requires a payload");
	if (!("target" in effect)) throw new Error("Engine effect requires a target");
	return structuredClone(effect as EngineEffectSettings);
}

function isPredefinedEffectSystem(system: ISystem): system is IPredefinedEffectSystem {
	return "acceptsEffect" in system && typeof system.acceptsEffect === "function" && "applyEffect" in system && typeof system.applyEffect === "function";
}
