import { EffectShield } from "../../effects/shield.js";
import { EffectSpawnTrigger } from "../../effects/spawnTrigger.js";
import { ItemEffectType, type ForceInput, type ItemEffectSettings } from "../../effects/types.js";
import { validateRuntimeItemEffectSettings } from "../../effects/validate.js";
import { createTemporalModifierTemplate, type TemporalModifierTemplate } from "../../engine/contracts/temporalModifier.js";
import { createStructureLifecycleTemplate, type StructureLifecycleTemplate } from "../../engine/contracts/structureLifecycle.js";
import { createDeferredEffectTemplate, type DeferredEffectTemplate } from "../../engine/contracts/deferredEffect.js";
import { applyActionModifiers, createActionModifier, createActionModifierTemplate, type ActionModifierTemplate } from "../../engine/contracts/actionModifier.js";
import { SeededRandom } from "../../utils/random.js";
import { createCollisionFilterTemplate, type CollisionFilterTemplate } from "../../engine/contracts/collisionFilter.js";
import { createActorEligibilityConstraintTemplate, type ActorEligibilityConstraintTemplate } from "../../engine/contracts/actorEligibility.js";

export type RuntimeItemEffect =
	| CollisionFilterTemplate
	| ActionModifierTemplate
	| ActorEligibilityConstraintTemplate
	| EffectShield
	| EffectSpawnTrigger
	| TemporalModifierTemplate
	| StructureLifecycleTemplate
	| DeferredEffectTemplate;

/**
 * The only KORE item-content-to-runtime construction boundary. Item content
 * remains declarative and callers never need to import effect implementations.
 */
export function createRuntimeItemEffect(settings: ItemEffectSettings): RuntimeItemEffect {
	validateRuntimeItemEffectSettings(settings);
	const value = settings.typeValue as Record<string, unknown>;
	switch (settings.type) {
		case ItemEffectType.ModifyForce:
			return createActionModifierTemplate({ action: "force", operation: "scale", factor: numberValue(value, "factor") });
		case ItemEffectType.GhostMode:
			return createCollisionFilterTemplate({ excludedCategories: ["entity", "structure"], durationUnit: "turns", duration: integerValue(value, "durationTurns") });
		case ItemEffectType.SelectionLock:
			return createActorEligibilityConstraintTemplate({ mode: "excluded", durationUnit: "turns", duration: integerValue(value, "durationTurns") });
		case ItemEffectType.Shield:
			return new EffectShield({ typeValue: { capacity: numberValue(value, "capacity") } });
		case ItemEffectType.SpawnTrigger:
			return new EffectSpawnTrigger({ typeValue: { triggerId: stringValue(value, "triggerId"), delayTurns: integerValue(value, "delayTurns"), ...(value.structureId === undefined ? {} : { structureId: stringValue(value, "structureId") }), ...(value.remainingTurns === undefined ? {} : { remainingTurns: integerValue(value, "remainingTurns") }), ...(value.fired === undefined ? {} : { fired: value.fired as boolean }), ...(value.resolvedTarget === undefined ? {} : { resolvedTarget: value.resolvedTarget as never }), ...(value.resolvedPosition === undefined ? {} : { resolvedPosition: value.resolvedPosition as never }) } });
		case ItemEffectType.AimVariance:
			return createActionModifierTemplate({
				action: "aim",
				operation: "random-offset",
				maxVarianceDegrees: numberValue(value, "maxVarianceDegrees"),
				randomState: value.randomState === undefined
					? new SeededRandom(value.seed === undefined ? 1337 : safeIntegerValue(value, "seed")).getState()
					: safeIntegerValue(value, "randomState"),
			});
		case ItemEffectType.TemporalModifier:
			return createTemporalModifierTemplate({ durationUnit: value.durationUnit as "turns", duration: integerValue(value, "duration"), effect: value.effect as never });
		case ItemEffectType.StructureLifecycle:
			return createStructureLifecycleTemplate({ durationUnit: value.durationUnit as "turns", duration: integerValue(value, "duration"), structure: value.structure as never });
		case ItemEffectType.DeferredEffect:
			return createDeferredEffectTemplate({ durationUnit: value.durationUnit as "ticks", duration: integerValue(value, "duration"), effect: value.effect as never });
		default:
			throw new Error(`Unsupported runtime item effect '${String(settings.type)}'`);
	}
}

export function resolveRuntimeItemEffects(effects: readonly { type: string; value?: Record<string, unknown> }[]): RuntimeItemEffect[] {
	return effects.map(effect => createRuntimeItemEffect({ type: effect.type as ItemEffectType, typeValue: structuredClone(effect.value ?? {}) } as ItemEffectSettings));
}

/** Advances turn-scoped item primitives and drops effects at their boundary. */
export function advanceRuntimeItemEffect(effect: ItemEffectSettings): ItemEffectSettings | undefined {
	return advanceRuntimeItemEffectTurn(effect).next;
}

export function advanceRuntimeItemEffectTurn(effect: ItemEffectSettings): { next?: ItemEffectSettings; due: boolean } {
	const runtime = createRuntimeItemEffect({ type: effect.type, typeValue: structuredClone(effect.typeValue) } as ItemEffectSettings);
	if (isActionModifierTemplate(runtime) || isCollisionFilterTemplate(runtime) || isActorEligibilityConstraintTemplate(runtime) || isTemporalModifierTemplate(runtime) || isStructureLifecycleTemplate(runtime) || isDeferredEffectTemplate(runtime)) return { next: structuredClone(effect), due: false };
	const advance = (runtime as unknown as { advanceTurn?: () => unknown }).advanceTurn;
	if (!advance) return { next: structuredClone(effect), due: false };
	if (runtime instanceof EffectSpawnTrigger && runtime.hasFired()) return { due: false };
	if (advance.call(runtime) === true) return { due: true };
	const next = runtime.toSettings();
	const value = next.typeValue as Record<string, unknown>;
	if (value.remainingTurns === 0 || value.active === false || value.fired === true) return { due: false };
	return { next: { ...effect, typeValue: structuredClone(value) } as ItemEffectSettings, due: false };
}

export function applyRuntimeForceEffects(force: ForceInput, effects: readonly RuntimeItemEffect[]): ForceInput {
	const modifiers = effects.flatMap((effect, index) => isActionModifierTemplate(effect) && effect.action === "force" ? [createActionModifier({ id: `runtime-action-modifier:${index}`, action: "force", operation: "scale", factor: effect.factor, remainingUses: 1, sourceOrder: index })] : []);
	return applyActionModifiers(force, modifiers);
}

function numberValue(value: Record<string, unknown>, key: string): number {
	const raw = value[key];
	if (typeof raw !== "number") throw new Error(`Item effect requires numeric ${key}`);
	return raw;
}

function integerValue(value: Record<string, unknown>, key: string): number {
	const raw = numberValue(value, key);
	if (!Number.isSafeInteger(raw)) throw new Error(`Item effect requires integer ${key}`);
	return raw;
}

function stringValue(value: Record<string, unknown>, key: string): string {
	const raw = value[key];
	if (typeof raw !== "string" || raw.length === 0) throw new Error(`Item effect requires non-empty ${key}`);
	return raw;
}

export function isTemporalModifierTemplate(value: RuntimeItemEffect): value is TemporalModifierTemplate {
	return "durationUnit" in value && "duration" in value && "effect" in value && value.effect.type === "movement.scale-speed";
}

export function isStructureLifecycleTemplate(value: RuntimeItemEffect): value is StructureLifecycleTemplate {
	return "durationUnit" in value && "duration" in value && "structure" in value;
}

export function isDeferredEffectTemplate(value: RuntimeItemEffect): value is DeferredEffectTemplate {
	return "durationUnit" in value && "duration" in value && "effect" in value && value.effect.type === "movement.apply-force-field";
}

export function isActionModifierTemplate(value: RuntimeItemEffect): value is ActionModifierTemplate {
	return "action" in value && ((value.action === "force" && "operation" in value && value.operation === "scale" && "factor" in value) || (value.action === "aim" && "operation" in value && value.operation === "random-offset" && "maxVarianceDegrees" in value && "randomState" in value));
}

export function isCollisionFilterTemplate(value: RuntimeItemEffect): value is CollisionFilterTemplate {
	return "excludedCategories" in value && "durationUnit" in value && value.durationUnit === "turns" && "duration" in value;
}

export function isActorEligibilityConstraintTemplate(value: RuntimeItemEffect): value is ActorEligibilityConstraintTemplate {
	return "mode" in value && value.mode === "excluded" && "durationUnit" in value && value.durationUnit === "turns" && "duration" in value;
}

function safeIntegerValue(value: Record<string, unknown>, key: string): number {
	const raw = value[key];
	if (typeof raw !== "number" || !Number.isSafeInteger(raw)) throw new Error(`Item effect requires safe integer ${key}`);
	return raw;
}
