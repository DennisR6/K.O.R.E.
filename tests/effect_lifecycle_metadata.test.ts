import { expect, test } from "bun:test";
import { CORE_EFFECT_LIFECYCLE, ITEM_EFFECT_LIFECYCLE, getEffectLifecycle } from "../src/effects/lifecycle.ts";
import { EffectType, ItemEffectType } from "../src/effects/types.ts";

test("every supported core and item Effect has explicit lifecycle metadata", () => {
	for (const metadata of Object.values(CORE_EFFECT_LIFECYCLE)) expect(metadata.category).toBeTruthy();
	for (const metadata of Object.values(ITEM_EFFECT_LIFECYCLE)) expect(metadata.execution).toBeTruthy();
	expect(Object.keys(CORE_EFFECT_LIFECYCLE)).toHaveLength(10);
	expect(Object.keys(ITEM_EFFECT_LIFECYCLE)).toHaveLength(12);
});

test("lifecycle metadata is static and independent from serialized settings", () => {
	expect(getEffectLifecycle(EffectType.Movement)).toEqual({ category: "modifier", execution: "tick", persistent: true });
	expect(getEffectLifecycle(ItemEffectType.TemporalModifier)).toEqual({ category: "status", execution: "turn", persistent: true });
});
