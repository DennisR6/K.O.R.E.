import type { EngineEffectSettings } from "../engine/sdk/effectRegistry.js";
import { validateEngineEffectComposition, type EngineEffectComposition } from "../engine/sdk/composition.js";
import type { IGameContext, IPredefinedEffectSystem, ResolvedPredefinedTarget, ISystem } from "./types.js";

/** Dispatches one validated Engine command through exactly one trusted interpreter. */
export function dispatchPredefinedEffect(options: {
	ctx: IGameContext;
	systems: readonly ISystem[];
	effect: unknown;
	positionOverride?: { x: number; y: number };
	depth?: number;
}): void {
	if ((options.depth ?? 0) > 32) throw new Error("Predefined effect follow-up depth exceeded");
	const effect = validateEnvelope(options.effect);
	const interpreters = options.systems.filter(isPredefinedEffectSystem).filter(system => system.acceptsEffect(effect.type));
	if (interpreters.length === 0) throw new Error(`No predefined system accepts effect '${effect.type}'`);
	if (interpreters.length > 1) throw new Error(`Multiple predefined systems accept effect '${effect.type}'`);
	const target = resolveTarget(options.ctx, effect.target, options.positionOverride);
	const followUps = interpreters[0]!.applyEffect(options.ctx, effect, target);
	for (const followUp of followUps ?? []) {
		const bound = followUp.target === undefined
			? { ...followUp, target: targetReference(target) }
			: followUp;
		dispatchPredefinedEffect({ ...options, effect: bound, depth: (options.depth ?? 0) + 1 });
	}
}

/** Dispatches an ordered current command composition through the same host. */
export function dispatchPredefinedComposition(options: {
	ctx: IGameContext;
	systems: readonly ISystem[];
	composition: EngineEffectComposition;
	positionOverride?: { x: number; y: number };
}): void {
	validateEngineEffectComposition(options.composition);
	for (const effect of options.composition.effects) dispatchPredefinedEffect({ ...options, effect, positionOverride: options.positionOverride });
}

function resolveTarget(ctx: IGameContext, value: unknown, positionOverride?: { x: number; y: number }): ResolvedPredefinedTarget {
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
	if (target.type === "numeric") {
		if (typeof target.entityId !== "string" || target.entityId.length === 0) throw new Error("Numeric target requires a non-empty entityId");
		if (typeof target.stateId !== "string" || target.stateId.length === 0) throw new Error("Numeric target requires a non-empty stateId");
		const entity = ctx.entities.getEntityById(target.entityId);
		if (!entity) throw new Error(`Unknown numeric entity target '${target.entityId}'`);
		return { type: "numeric", entity, stateId: target.stateId };
	}
	if (target.type === "structure") {
		if (typeof target.structureId !== "string" || target.structureId.length === 0) throw new Error("Structure target requires a non-empty structureId");
		const structure = ctx.structures.find(candidate => candidate.getId() === target.structureId);
		if (!structure) throw new Error(`Unknown structure target '${target.structureId}'`);
		return { type: "structure", structure, ...(positionOverride ? { positionOverride: { ...positionOverride } } : {}) };
	}
	throw new Error(`Unknown predefined target type '${String(target.type)}'`);
}

function targetReference(target: ResolvedPredefinedTarget): Record<string, string> {
	if (target.type === "entity") return { type: "entity", entityId: String(target.entity.getId()) };
	if (target.type === "numeric") return { type: "entity", entityId: String(target.entity.getId()) };
	if (target.type === "structure") return { type: "structure", structureId: String(target.structure.getId()) };
	throw new Error("Counter targets cannot receive relative follow-up effects");
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
