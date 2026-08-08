import { EffectType, ItemEffectType } from "./types.js";

export type EffectLifecycleCategory = "modifier" | "command" | "reaction" | "status" | "scheduled";
export type EffectLifecycleExecution = "tick" | "collision" | "turn" | "action" | "composition";

export interface EffectLifecycleMetadata {
	readonly category: EffectLifecycleCategory;
	readonly execution: EffectLifecycleExecution;
	readonly persistent: boolean;
}

/** Static metadata for core Effects; it is not embedded in serialized settings. */
export const CORE_EFFECT_LIFECYCLE: Readonly<Record<EffectType, EffectLifecycleMetadata>> = {
	[EffectType.Physics]: { category: "modifier", execution: "tick", persistent: true },
	[EffectType.NumericAdd]: { category: "command", execution: "collision", persistent: false },
	[EffectType.Movement]: { category: "modifier", execution: "tick", persistent: true },
	[EffectType.Multi]: { category: "command", execution: "composition", persistent: false },
	[EffectType.ModifyMass]: { category: "modifier", execution: "action", persistent: false },
	[EffectType.ModifySize]: { category: "modifier", execution: "action", persistent: false },
	[EffectType.Position]: { category: "command", execution: "action", persistent: false },
	[EffectType.Velocity]: { category: "command", execution: "action", persistent: false },
	[EffectType.Team]: { category: "command", execution: "action", persistent: false },
	[EffectType.ModifySetting]: { category: "command", execution: "action", persistent: false },
};

/** Static metadata for item runtime Effects; item state remains separately serialized. */
export const ITEM_EFFECT_LIFECYCLE: Readonly<Record<ItemEffectType, EffectLifecycleMetadata>> = {
	[ItemEffectType.ModifyForce]: { category: "modifier", execution: "action", persistent: true },
	[ItemEffectType.ModifyRotation]: { category: "modifier", execution: "action", persistent: true },
	[ItemEffectType.LockRotation]: { category: "status", execution: "turn", persistent: true },
	[ItemEffectType.ApplyTorque]: { category: "modifier", execution: "tick", persistent: true },
	[ItemEffectType.SpawnTrigger]: { category: "scheduled", execution: "turn", persistent: true },
	[ItemEffectType.DeferredEffect]: { category: "scheduled", execution: "tick", persistent: true },
	[ItemEffectType.Shield]: { category: "status", execution: "collision", persistent: true },
	[ItemEffectType.StructureLifecycle]: { category: "status", execution: "turn", persistent: true },
	[ItemEffectType.GhostMode]: { category: "status", execution: "collision", persistent: true },
	[ItemEffectType.SelectionLock]: { category: "status", execution: "turn", persistent: true },
	[ItemEffectType.AimVariance]: { category: "modifier", execution: "action", persistent: true },
	[ItemEffectType.TemporalModifier]: { category: "status", execution: "turn", persistent: true },
};

export function getEffectLifecycle(type: EffectType | ItemEffectType): EffectLifecycleMetadata {
	if (type in CORE_EFFECT_LIFECYCLE) return CORE_EFFECT_LIFECYCLE[type as EffectType];
	if (type in ITEM_EFFECT_LIFECYCLE) return ITEM_EFFECT_LIFECYCLE[type as ItemEffectType];
	throw new Error(`Unknown Effect lifecycle type '${String(type)}'`);
}
