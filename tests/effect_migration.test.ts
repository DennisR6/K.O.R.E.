import { expect, test } from "bun:test";
import { migrateEffectSettings, migrateFullEffectSettings, migrateGameSettingsEffects, migrateItemDocument } from "../src/migrations/effects.ts";
import { validateEffectSettings, validateFullEffectSettings } from "../src/effects/validate.ts";
import { EffectType, EffectTrigger } from "../src/effects/types.ts";
import { ankerItem } from "../src/item/officialItems.ts";

test("the migration boundary upgrades historical unversioned Effects recursively", () => {
	const migrated = migrateEffectSettings({ type: EffectType.Multi, typeValue: [{ type: "EffectType.Damage", typeValue: { damage: 5 } }] });

	expect(migrated).toEqual({ schemaVersion: 1, type: EffectType.Multi, typeValue: [{ schemaVersion: 1, type: EffectType.NumericAdd, typeValue: { stateId: "hp", amount: -5 } }] });
	expect(() => validateEffectSettings(migrated)).not.toThrow();
	 expect(() => validateEffectSettings({ type: "EffectType.Damage", typeValue: { damage: 5 } })).toThrow(/schema version/);
});

test("full Effect migration preserves trigger composition without moving trigger logic into Effects", () => {
	const migrated = migrateFullEffectSettings({ trigger: EffectTrigger.Collision, triggerValue: [], type: "EffectType.Damage", typeValue: { damage: 5 } });

	expect(migrated).toEqual({ schemaVersion: 1, trigger: EffectTrigger.Collision, triggerValue: [], type: EffectType.NumericAdd, typeValue: { stateId: "hp", amount: -5 } });
	expect(() => validateFullEffectSettings(migrated)).not.toThrow();
});

test("the migration boundary rejects unknown historical schema versions", () => {
	expect(() => migrateEffectSettings({ schemaVersion: 2, type: "EffectType.Damage", typeValue: { damage: 5 } })).toThrow(/Unsupported historical Effect schema version/);
});

test("the migration boundary lowers historical Magnet documents and drops already-applied runtime state", () => {
	const item = migrateItemDocument({ schemaVersion: 1, id: "magnet", name: "Magnet", type: "offensive", effects: [{ type: "magnet", value: { strength: 2, range: 100 } }], targetType: "entity", duration: { type: "instant", value: 0 }, useLimit: { perTurn: 1, perGame: 2 } });
	expect(item.effects).toEqual([{ type: "movement.apply-force-to-entity", value: { mode: "attract", force: 2, range: 100 } }]);
	const settings: any = { players: [{ itemEffects: [{ type: "magnet", typeValue: { mode: "attract", force: 2, range: 100 } }], effects: [] }], items: [item], effects: [], mapBoundarys: [] };
	const migrated = migrateGameSettingsEffects(settings);
	expect(migrated.players[0]!.itemEffects).toEqual([]);
});

test("the migration boundary lowers historical Switch documents and drops applied swap state", () => {
	const item = migrateItemDocument({ schemaVersion: 1, id: "switch", name: "Switch", type: "utility", effects: [{ type: "swapPosition", value: {} }], targetType: "entity", duration: { type: "instant", value: 0 }, useLimit: { perTurn: 1, perGame: 1 } });
	expect(item.effects).toEqual([{ type: "transform.swap-position", value: {} }]);
	const settings: any = { players: [{ itemEffects: [{ type: "swapPosition", typeValue: {} }], effects: [] }], items: [item], effects: [], mapBoundarys: [] };
	expect(migrateGameSettingsEffects(settings).players[0]!.itemEffects).toEqual([]);
});

test("the migration boundary moves historical modifyForce state into pending action modifiers", () => {
	const settings: any = {
		players: [{ id: "actor-1", itemEffects: [{ type: "modifyForce", typeValue: { factor: 1.5 }, itemId: "power-dash", order: 0 }], effects: [] }],
		items: [],
		effects: [],
		mapBoundarys: [],
	};

	const migrated = migrateGameSettingsEffects(settings);
	expect(migrated.players[0]!.itemEffects).toEqual([]);
	expect(migrated.players[0]!.pendingActionModifiers).toEqual([{
		schemaVersion: 1,
		id: "actor-1:action-modifier:0",
		action: "force",
		operation: "scale",
		factor: 1.5,
		remainingUses: 1,
		sourceId: "power-dash",
		sourceOrder: 0,
	}]);
});

test("historical Anker modifyForce state restores its declared turn lifetime", () => {
	const settings: any = {
		players: [{ id: "actor-anker", itemEffects: [{ type: "modifyForce", typeValue: { factor: 0.5 }, itemId: "anker", order: 0 }], effects: [] }],
		items: [ankerItem],
		effects: [],
		mapBoundarys: [],
	};

	const migrated = migrateGameSettingsEffects(settings);
	expect(migrated.players[0]!.pendingActionModifiers).toEqual([expect.objectContaining({
		action: "force",
		factor: 0.5,
		durationUnit: "turns",
		duration: 2,
		remaining: 2,
		sourceId: "anker",
	})]);
});

test("historical Vodka-Zero state migrates to a one-shot canonical aim modifier", () => {
	const settings: any = {
		players: [{ id: "actor-vodka", itemEffects: [{ type: "aimVariance", typeValue: { maxVarianceDegrees: 10, seed: 999 }, itemId: "vodka-zero", order: 3 }], effects: [] }],
		items: [],
		effects: [],
		mapBoundarys: [],
	};

	const migrated = migrateGameSettingsEffects(settings);
	expect(migrated.players[0]!.itemEffects).toEqual([]);
	expect(migrated.players[0]!.pendingActionModifiers).toEqual([expect.objectContaining({
		action: "aim",
		operation: "random-offset",
		maxVarianceDegrees: 10,
		randomState: 999,
		remainingUses: 1,
		sourceId: "vodka-zero",
		sourceOrder: 3,
	})]);
});

test("historical Ghost Mode state migrates to a category filter with separate turn lifetime", () => {
	const settings: any = {
		players: [{ id: "actor-ghost", itemEffects: [{ type: "ghostMode", typeValue: { durationTurns: 2, remainingTurns: 1 }, itemId: "durchlaessigkeit", order: 4 }], effects: [] }],
		items: [],
		effects: [],
		mapBoundarys: [],
	};

	const migrated = migrateGameSettingsEffects(settings);
	expect(migrated.players[0]!.itemEffects).toEqual([]);
	expect(migrated.players[0]!.collisionFilters).toEqual([expect.objectContaining({ id: "actor-ghost:collision-filter:0", excludedCategories: ["entity", "structure"], sourceId: "durchlaessigkeit", sourceOrder: 4 })]);
	expect(migrated.players[0]!.collisionFilterLifetimes).toEqual([expect.objectContaining({ filterId: "actor-ghost:collision-filter:0", duration: 2, remaining: 1, sourceId: "durchlaessigkeit", sourceOrder: 4 })]);
});

test("historical Selection Lock state migrates to an excluded actor constraint with separate turn lifetime", () => {
	const settings: any = {
		players: [{ id: "actor-selection", itemEffects: [{ type: "selectionLock", typeValue: { durationTurns: 2, remainingTurns: 1 }, itemId: "jaegermeister-elixier", order: 2 }], effects: [] }],
		items: [],
		effects: [],
		mapBoundarys: [],
	};

	const migrated = migrateGameSettingsEffects(settings);
	expect(migrated.players[0]!.itemEffects).toEqual([]);
	expect(migrated.players[0]!.actorEligibilityConstraints).toEqual([expect.objectContaining({ id: "actor-selection:actor-eligibility:0", mode: "excluded", sourceId: "jaegermeister-elixier", sourceOrder: 2 })]);
	expect(migrated.players[0]!.actorEligibilityConstraintLifetimes).toEqual([expect.objectContaining({ constraintId: "actor-selection:actor-eligibility:0", duration: 2, remaining: 1, sourceId: "jaegermeister-elixier", sourceOrder: 2 })]);
});
