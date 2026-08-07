import { expect, test } from "bun:test";
import { EffectType } from "../src/effects/types.ts";
import { TriggerDefinitionCatalog, validateTriggerDefinition } from "../src/item/triggerDefinitions.ts";

const damageDefinition = { schemaVersion: 1 as const, id: "trap.explode", effect: { schemaVersion: 1 as const, type: EffectType.Damage, typeValue: { damage: 5 } } } as const;

test("TriggerDefinitionCatalog validates detached named core Effects", () => {
	const catalog = new TriggerDefinitionCatalog().register(damageDefinition);
	const loaded = catalog.require("trap.explode");
	loaded.effect.typeValue.damage = 99;

	expect(catalog.require("trap.explode").effect.typeValue).toEqual({ damage: 5 });
	expect(catalog.describe()).toEqual([{ schemaVersion: 1, id: "trap.explode", effectType: EffectType.Damage }]);
});

test("TriggerDefinitionCatalog rejects duplicates, unknown IDs, invalid Effects, and executable fields", () => {
	const catalog = new TriggerDefinitionCatalog().register(damageDefinition);

	expect(() => catalog.register(damageDefinition)).toThrow(/Duplicate/);
	expect(() => catalog.require("missing")).toThrow(/Unknown/);
	expect(() => validateTriggerDefinition({ ...damageDefinition, effect: { schemaVersion: 1, type: EffectType.Damage, typeValue: { damage: -1 } } })).toThrow();
	expect(() => validateTriggerDefinition({ ...damageDefinition, callback: () => undefined })).toThrow(/unknown field/);
});

test("TriggerDefinition supports MultiEffect declaration order", () => {
	const catalog = new TriggerDefinitionCatalog().register({ schemaVersion: 1, id: "combo", effect: { schemaVersion: 1, type: EffectType.Multi, typeValue: [damageDefinition.effect] } });

	expect(catalog.require("combo").effect.typeValue).toEqual([damageDefinition.effect]);
});
