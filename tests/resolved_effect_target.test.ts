import { expect, test } from "bun:test";
import { createEntityResolvedTarget, createPositionResolvedTarget, validateResolvedEffectTarget } from "../src/item/resolvedTarget.ts";
import { validateRuntimeItemEffectSettings } from "../src/effects/validate.ts";
import { ItemEffectType } from "../src/effects/types.ts";

test("resolved targets are detached, versioned, and strictly validated", () => {
	const position = { x: 12, y: 34 };
	const target = createPositionResolvedTarget(position);
	position.x = 99;

	expect(target).toEqual({ schemaVersion: 1, type: "position", position: { x: 12, y: 34 } });
	expect(createEntityResolvedTarget("entity-1")).toEqual({ schemaVersion: 1, type: "entity", entityId: "entity-1" });
	expect(() => validateResolvedEffectTarget({ schemaVersion: 1, type: "position", position: { x: 0, y: 0, z: 1 } })).toThrow(/unknown field/);
});

test("delayed item state accepts a resolved entity or position target but rejects zones", () => {
	const base = { type: ItemEffectType.DelayedEffect as const, typeValue: { effectType: ItemEffectType.Magnet, effectValue: { mode: "repel", force: 1, range: 10 }, delayTicks: 2 } };

	expect(() => validateRuntimeItemEffectSettings({ ...base, typeValue: { ...base.typeValue, resolvedTarget: createEntityResolvedTarget("entity-1") } })).not.toThrow();
	expect(() => validateRuntimeItemEffectSettings({ ...base, typeValue: { ...base.typeValue, resolvedTarget: createPositionResolvedTarget({ x: 2, y: 3 }) } })).not.toThrow();
	expect(() => validateRuntimeItemEffectSettings({ ...base, typeValue: { ...base.typeValue, resolvedTarget: { schemaVersion: 1, type: "zone", zoneId: "z" } } })).toThrow(/Unsupported resolved Effect target/);
});
