import { expect, test } from "bun:test";
import { EffectAimVariance } from "../src/effects/aimVariance.ts";
import { ItemEffectType } from "../src/effects/types.ts";
import { createOfficialItemLoader, createVodkaZero, vodkaZeroItem } from "../src/item/officialItems.ts";

test("Vodka-Zero is loaded as a validated built-in self-targeted item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("vodka-zero")).toBe("built-in");
	expect(loader.get("vodka-zero")).toEqual(vodkaZeroItem);
	expect(vodkaZeroItem.effects).toEqual([{ type: "aimVariance", value: { maxVarianceDegrees: 10 } }]);
	expect(vodkaZeroItem.targetValidation).toEqual({ allowSelf: true, allowAlly: false, allowEnemy: false });
});

test("Vodka-Zero applies seeded deterministic aim variance reproducibly", () => {
	const effect1 = createVodkaZero(12345);
	const effect2 = createVodkaZero(12345);

	const force = { angle: 90, power: 5 };
	const res1 = effect1.applyToForce(force);
	const res2 = effect2.applyToForce(force);

	expect(res1).toEqual(res2);
	expect(res1.angle).not.toBe(90);
	expect(Math.abs(res1.angle - 90)).toBeLessThanOrEqual(10);
	expect(res1.power).toBe(5);
});

test("Vodka-Zero effect state serializes and restores exact random sequence", () => {
	const effect = createVodkaZero(999);
	const force = { angle: 45, power: 8 };
	const firstApply = effect.applyToForce(force);

	const settings = effect.toSettings();
	expect(settings.type).toBe(ItemEffectType.AimVariance);

	const restored = new EffectAimVariance(settings);
	const secondApply = restored.applyToForce(force);

	// Next random value should match identically
	const effectAgain = createVodkaZero(999);
	effectAgain.applyToForce(force);
	const referenceApply = effectAgain.applyToForce(force);

	expect(secondApply).toEqual(referenceApply);
});

test("Vodka-Zero rejects invalid max variance configuration", () => {
	expect(() => new EffectAimVariance({ typeValue: { maxVarianceDegrees: -1 } })).toThrow("finite non-negative");
	expect(() => new EffectAimVariance({ typeValue: { maxVarianceDegrees: Number.NaN } })).toThrow("finite non-negative");
});
