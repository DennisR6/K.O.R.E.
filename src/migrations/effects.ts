import { EffectType, EFFECT_SCHEMA_VERSION, type EffectSettings, type FullEffectSettings } from "../effects/types.js";
import type { EngineSettings } from "../engine/types.js";
import type { GameSettings } from "../settings/settings.js";
import { migrateStructureSettings } from "./structures.js";
import type { EngineEffectComposition } from "../engine/sdk/composition.js";
import type { ItemDocument } from "../item/types.js";
import { MOVEMENT_APPLY_FORCE_TO_ENTITY_EFFECT_ID } from "../engine/sdk/movementCapability.js";

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
	copy.effects = (copy.effects ?? []).map(migrateFullEffectSettings);
	copy.players = copy.players.map(player => ({
		...player,
		effects: (player.effects ?? []).map(migrateFullEffectSettings),
		...(player.itemEffects ? { itemEffects: player.itemEffects.filter(effect => (effect.type as string) !== "magnet") } : {}),
	}));
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
