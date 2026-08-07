import { expect, test } from "bun:test";
import { migrateEffectSettings, migrateFullEffectSettings } from "../src/migrations/effects.ts";
import { validateEffectSettings, validateFullEffectSettings } from "../src/effects/validate.ts";
import { EffectType, EffectTrigger } from "../src/effects/types.ts";

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
