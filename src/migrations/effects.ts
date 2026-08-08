import { EffectType, EFFECT_SCHEMA_VERSION, type EffectSettings, type FullEffectSettings } from "../effects/types.js";
import type { EngineSettings } from "../engine/types.js";
import type { GameSettings } from "../settings/settings.js";
import { migrateStructureSettings } from "./structures.js";
import type { EngineEffectComposition } from "../engine/sdk/composition.js";
import type { ItemDocument } from "../item/types.js";
import { MOVEMENT_APPLY_FORCE_TO_ENTITY_EFFECT_ID } from "../engine/sdk/movementCapability.js";
import { createActionModifier } from "../engine/contracts/actionModifier.js";
import { SeededRandom } from "../utils/random.js";
import { createCollisionFilter, createCollisionFilterLifetime } from "../engine/contracts/collisionFilter.js";

/** Upgrades the repository's historical unversioned core Effect form. */
export function migrateEffectSettings(value: unknown): EffectSettings {
	if (!isRecord(value)) throw new Error("Effect migration requires an object");
	if (value.schemaVersion !== undefined && value.schemaVersion !== EFFECT_SCHEMA_VERSION) throw new Error(`Unsupported historical Effect schema version: ${String(value.schemaVersion)}`);
	if (value.type === "EffectType.Damage") {
		const payload = isRecord(value.typeValue) ? value.typeValue : undefined;
		if (!payload || typeof payload.damage !== "number" || !Number.isFinite(payload.damage) || payload.damage < 0) throw new Error("Historical Damage payload is invalid");
		return { schemaVersion: EFFECT_SCHEMA_VERSION, type: EffectType.NumericAdd, typeValue: { stateId: "hp", amount: -payload.damage } };
	}
	const effect = { schemaVersion: EFFECT_SCHEMA_VERSION, type: value.type, typeValue: structuredClone(value.typeValue) } as EffectSettings;
	if (effect.type === "EffectType.Multi" && Array.isArray(effect.typeValue)) effect.typeValue = effect.typeValue.map(migrateEffectSettings);
	return effect;
}

export function migrateFullEffectSettings(value: unknown): FullEffectSettings {
	if (!isRecord(value)) throw new Error("Full Effect migration requires an object");
	return { ...migrateEffectSettings(value), trigger: value.trigger as FullEffectSettings["trigger"], triggerValue: structuredClone(value.triggerValue) } as FullEffectSettings;
}

/** Normalizes only Effect-bearing fields before strict runtime construction. */
export function migrateGameSettingsEffects<T extends GameSettings | EngineSettings>(settings: T): T {
	const copy = structuredClone(settings) as T;
	copy.items = copy.items.map(migrateItemDocument);
	const itemsById = new Map(copy.items.map(item => [item.id, item]));
	copy.effects = (copy.effects ?? []).map(migrateFullEffectSettings);
	copy.players = copy.players.map(player => {
		const historicalActionModifiers = (player.itemEffects ?? []).flatMap((effect, index) => {
			const sourceItem = effect.itemId === undefined ? undefined : itemsById.get(effect.itemId);
			if (effect.type === "modifyForce") {
				const factor = effect.typeValue.factor;
				if (typeof factor !== "number") throw new Error("Historical modifyForce effect requires a numeric factor");
				return [createActionModifier({
					id: `${player.id}:action-modifier:${index}`,
					action: "force",
					operation: "scale",
					factor,
					...(sourceItem?.duration.type === "turns" ? { durationUnit: "turns" as const, duration: sourceItem.duration.value, remaining: sourceItem.duration.value } : { remainingUses: 1 }),
					sourceId: effect.itemId,
					sourceOrder: effect.order,
				})];
			}
			if (effect.type === "aimVariance") {
				const maxVarianceDegrees = effect.typeValue.maxVarianceDegrees;
				if (typeof maxVarianceDegrees !== "number" || !Number.isFinite(maxVarianceDegrees) || maxVarianceDegrees < 0) throw new Error("Historical aimVariance requires a finite non-negative max variance");
				const rawState = effect.typeValue.randomState;
				const seed = effect.typeValue.seed;
				if (rawState !== undefined && (typeof rawState !== "number" || !Number.isSafeInteger(rawState) || rawState < 0 || rawState > 0xFFFFFFFF)) throw new Error("Historical aimVariance random state must be an unsigned 32-bit integer");
				if (seed !== undefined && (typeof seed !== "number" || !Number.isSafeInteger(seed))) throw new Error("Historical aimVariance seed must be a safe integer");
				const randomState = rawState === undefined ? new SeededRandom(seed === undefined ? 1337 : seed).getState() : rawState;
				return [createActionModifier({
					id: `${player.id}:action-modifier:${index}`,
					action: "aim",
					operation: "random-offset",
					maxVarianceDegrees,
					randomState,
					remainingUses: 1,
					sourceId: effect.itemId,
					sourceOrder: effect.order,
				})];
			}
			return [];
		});
		const historicalCollisionFilters = (player.itemEffects ?? []).flatMap((effect, index) => {
			if (effect.type !== "ghostMode") return [];
			const durationTurns = effect.typeValue.durationTurns;
			const remainingTurns = effect.typeValue.remainingTurns ?? durationTurns;
			if (typeof durationTurns !== "number" || !Number.isSafeInteger(durationTurns) || durationTurns < 1) throw new Error("Historical ghostMode requires a positive duration");
			if (typeof remainingTurns !== "number" || !Number.isSafeInteger(remainingTurns) || remainingTurns < 1 || remainingTurns > durationTurns) return [];
			const filterId = `${player.id}:collision-filter:${index}`;
			return [{
				filter: createCollisionFilter({ id: filterId, excludedCategories: ["entity", "structure"], sourceId: effect.itemId, sourceOrder: effect.order }),
				lifetime: createCollisionFilterLifetime({ id: `${filterId}:lifetime`, filterId, durationUnit: "turns", duration: durationTurns, remaining: remainingTurns, sourceId: effect.itemId, sourceOrder: effect.order }),
			}];
		});
		return {
			...player,
			effects: (player.effects ?? []).map(migrateFullEffectSettings),
			...(player.itemEffects ? { itemEffects: player.itemEffects.filter(effect => !["magnet", "swapPosition", "modifyForce", "aimVariance", "ghostMode"].includes(effect.type as string)) } : {}),
			...(historicalActionModifiers.length || player.pendingActionModifiers?.length ? { pendingActionModifiers: [...(player.pendingActionModifiers ?? []), ...historicalActionModifiers] } : {}),
			...(historicalCollisionFilters.length || player.collisionFilters?.length ? { collisionFilters: [...(player.collisionFilters ?? []), ...historicalCollisionFilters.map(entry => entry.filter)] } : {}),
			...(historicalCollisionFilters.length || player.collisionFilterLifetimes?.length ? { collisionFilterLifetimes: [...(player.collisionFilterLifetimes ?? []), ...historicalCollisionFilters.map(entry => entry.lifetime)] } : {}),
		};
	});
	copy.mapBoundarys = migrateStructureSettings(copy.mapBoundarys ?? []).map(boundary => ({ ...boundary, effects: (boundary.effects ?? []).map(migrateFullEffectSettings) }));
	if (copy.triggerDefinitions) copy.triggerDefinitions = copy.triggerDefinitions.map(definition => ({ ...definition, effect: isEngineEffectComposition(definition.effect) ? structuredClone(definition.effect) : migrateEffectSettings(definition.effect) }));
	if (copy.environmentalMechanics) copy.environmentalMechanics = copy.environmentalMechanics.map(mechanic => mechanic.effects === undefined ? mechanic : { ...mechanic, effects: mechanic.effects.map(migrateFullEffectSettings) });
	return copy;
}

/** Upgrades the historical Magnet Item document to the generic movement command. */
export function migrateItemDocument(item: ItemDocument): ItemDocument {
	return {
		...item,
		effects: item.effects.map(effect => {
			if (effect.type === "swapPosition") return { type: "transform.swap-position", value: {} };
			if (effect.type !== "magnet") return structuredClone(effect);
			const value = effect.value ?? {};
			const force = typeof value.force === "number" ? value.force : value.strength;
			if (typeof force !== "number") throw new Error("Historical Magnet effect requires force or strength");
			return { type: MOVEMENT_APPLY_FORCE_TO_ENTITY_EFFECT_ID, value: { mode: "attract", force, range: value.range } };
		}),
	};
}

function isEngineEffectComposition(value: unknown): value is EngineEffectComposition {
	return typeof value === "object" && value !== null && !Array.isArray(value) && (value as { type?: unknown }).type === "effect.composition";
}

function isRecord(value: unknown): value is Record<string, any> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
