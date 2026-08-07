import { EffectAimVariance } from "../../effects/aimVariance.js";
import { EffectDelayed } from "../../effects/delayedEffect.js";
import { EffectFreeze } from "../../effects/freeze.js";
import { EffectGhostMode } from "../../effects/ghostMode.js";
import { EffectMagnet } from "../../effects/magnet.js";
import { EffectModifyForce } from "../../effects/modifyForce.js";
import { EffectSelectionLock } from "../../effects/selectionLock.js";
import { EffectShield } from "../../effects/shield.js";
import { EffectSpawnTrigger } from "../../effects/spawnTrigger.js";
import { EffectSwapPosition } from "../../effects/swapPosition.js";
import { EffectTemporaryWall } from "../../effects/temporaryWall.js";
import { ItemEffectType, type ForceInput, type ItemEffectSettings } from "../../effects/types.js";

export type RuntimeItemEffect =
	| EffectAimVariance
	| EffectDelayed
	| EffectFreeze
	| EffectGhostMode
	| EffectMagnet
	| EffectModifyForce
	| EffectSelectionLock
	| EffectShield
	| EffectSpawnTrigger
	| EffectSwapPosition
	| EffectTemporaryWall;

/**
 * The only KORE item-content-to-runtime construction boundary. Item content
 * remains declarative and callers never need to import effect implementations.
 */
export function createRuntimeItemEffect(settings: ItemEffectSettings): RuntimeItemEffect {
	const value = settings.typeValue as Record<string, unknown>;
	switch (settings.type) {
		case ItemEffectType.ModifyForce:
			return new EffectModifyForce({ typeValue: { factor: numberValue(value, "factor", "multiplier") } });
		case ItemEffectType.Freeze:
			return new EffectFreeze({ typeValue: { speedFactor: numberValue(value, "speedFactor", "factor", 0.25), durationTurns: integerValue(value, "durationTurns"), ...(value.remainingTurns === undefined ? {} : { remainingTurns: integerValue(value, "remainingTurns") }) } });
		case ItemEffectType.GhostMode:
			return new EffectGhostMode({ typeValue: { durationTurns: integerValue(value, "durationTurns"), ...(value.remainingTurns === undefined ? {} : { remainingTurns: integerValue(value, "remainingTurns") }) } });
		case ItemEffectType.Magnet:
			return new EffectMagnet({ typeValue: { mode: value.mode === undefined ? "attract" : value.mode as "attract" | "repel", force: numberValue(value, "force", "strength"), range: numberValue(value, "range") } });
		case ItemEffectType.SelectionLock:
			return new EffectSelectionLock({ typeValue: { durationTurns: integerValue(value, "durationTurns"), ...(value.remainingTurns === undefined ? {} : { remainingTurns: integerValue(value, "remainingTurns") }) } });
		case ItemEffectType.Shield:
			return new EffectShield({ typeValue: { capacity: numberValue(value, "capacity") } });
		case ItemEffectType.SpawnTrigger:
			return new EffectSpawnTrigger({ typeValue: { triggerId: stringValue(value, "triggerId", "triggerType"), delayTurns: integerValue(value, "delayTurns", "delayTicks", 0), ...(value.remainingTurns === undefined ? {} : { remainingTurns: integerValue(value, "remainingTurns") }), ...(value.fired === undefined ? {} : { fired: value.fired as boolean }) } });
		case ItemEffectType.DelayedEffect: {
			const nested = value.effectValue ?? value.effect;
			return new EffectDelayed({ typeValue: { effectType: stringValue(value, "effectType"), effectValue: nested as Record<string, unknown> | undefined, delayTicks: integerValue(value, "delayTicks"), ...(value.resolvedTarget === undefined ? {} : { resolvedTarget: value.resolvedTarget as never }) } });
		}
		case ItemEffectType.TemporaryWall:
			return new EffectTemporaryWall({ typeValue: {
				wallId: stringValue(value, "wallId"), x: numberValue(value, "x", undefined, 0), y: numberValue(value, "y", undefined, 0),
				w: numberValue(value, "w", undefined, 1), h: numberValue(value, "h", undefined, 1), durationTurns: integerValue(value, "durationTurns", "lifetimeTurns"), ...(value.remainingTurns === undefined ? {} : { remainingTurns: integerValue(value, "remainingTurns") }), ...(value.active === undefined ? {} : { active: value.active as boolean }),
			} });
		case ItemEffectType.AimVariance:
			return new EffectAimVariance({ typeValue: { maxVarianceDegrees: numberValue(value, "maxVarianceDegrees") } });
		case ItemEffectType.SwapPosition:
			return new EffectSwapPosition();
		default:
			throw new Error(`Unsupported runtime item effect '${String(settings.type)}'`);
	}
}

export function resolveRuntimeItemEffects(effects: readonly { type: string; value?: Record<string, unknown> }[]): RuntimeItemEffect[] {
	return effects.map(effect => createRuntimeItemEffect({ type: effect.type as ItemEffectType, typeValue: structuredClone(effect.value ?? {}) } as ItemEffectSettings));
}

/** Advances turn-scoped item primitives and drops effects at their boundary. */
export function advanceRuntimeItemEffect(effect: ItemEffectSettings): ItemEffectSettings | undefined {
	const runtime = createRuntimeItemEffect({ type: effect.type, typeValue: structuredClone(effect.typeValue) } as ItemEffectSettings);
	const advance = (runtime as unknown as { advanceTurn?: () => unknown }).advanceTurn;
	if (advance) advance.call(runtime);
	const next = runtime.toSettings();
	const value = next.typeValue as Record<string, unknown>;
	if (value.remainingTurns === 0 || value.active === false || value.fired === true) return undefined;
	return { ...effect, typeValue: structuredClone(value) } as ItemEffectSettings;
}

export function advanceRuntimeItemEffectTick(effect: ItemEffectSettings): { next?: ItemEffectSettings; due: boolean } {
	const runtime = createRuntimeItemEffect({ type: effect.type, typeValue: structuredClone(effect.typeValue) } as ItemEffectSettings);
	const advance = (runtime as unknown as { advanceTick?: () => unknown }).advanceTick;
	if (!advance) return { next: structuredClone(effect), due: false };
	if (runtime instanceof EffectDelayed && runtime.hasFired()) return { due: false };
	if (advance.call(runtime) === true) return { due: true };
	const next = runtime.toSettings();
	const value = next.typeValue as Record<string, unknown>;
	if (value.fired === true) return { due: false };
	return { next: { ...effect, typeValue: structuredClone(value) } as ItemEffectSettings, due: false };
}

export function applyRuntimeForceEffects(force: ForceInput, effects: readonly RuntimeItemEffect[]): ForceInput {
	return effects.reduce((current, effect) => effect instanceof EffectModifyForce ? effect.applyToForce(current) : current, force);
}

function numberValue(value: Record<string, unknown>, key: string, alias?: string, fallback?: number): number {
	const raw = value[key] ?? (alias ? value[alias] : undefined) ?? fallback;
	if (typeof raw !== "number") throw new Error(`Item effect requires numeric ${key}`);
	return raw;
}

function integerValue(value: Record<string, unknown>, key: string, alias?: string, fallback?: number): number {
	const raw = numberValue(value, key, alias, fallback);
	if (!Number.isSafeInteger(raw)) throw new Error(`Item effect requires integer ${key}`);
	return raw;
}

function stringValue(value: Record<string, unknown>, key: string, alias?: string): string {
	const raw = value[key] ?? (alias ? value[alias] : undefined);
	if (typeof raw !== "string" || raw.length === 0) throw new Error(`Item effect requires non-empty ${key}`);
	return raw;
}
