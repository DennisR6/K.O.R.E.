import { expect, test } from "bun:test";
import { EffectAimVariance } from "../src/effects/aimVariance.ts";
import { applyActionModifiers, consumeActionModifiers } from "@coffeemakerstudio/roast";
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
	const res1 = applyActionModifiers(force, [{ ...effect1, id: "one", remainingUses: 1, schemaVersion: 1 }]);
	const res2 = applyActionModifiers(force, [{ ...effect2, id: "two", remainingUses: 1, schemaVersion: 1 }]);

	expect(res1).toEqual(res2);
	expect(res1.angle).not.toBe(90);
	expect(Math.abs(res1.angle - 90)).toBeLessThanOrEqual(10);
	expect(res1.power).toBe(5);
});

test("Vodka-Zero action state serializes and restores exact random sequence", () => {
	const effect = { ...createVodkaZero(999), id: "vodka", remainingUses: 2, schemaVersion: 1 as const };
	const force = { angle: 45, power: 8 };
	const firstApply = applyActionModifiers(force, [effect]);
	const restored = JSON.parse(JSON.stringify(consumeActionModifiers([effect])[0]));
	const secondApply = applyActionModifiers(force, [restored]);

	const effectAgain = { ...createVodkaZero(999), id: "reference", remainingUses: 2, schemaVersion: 1 as const };
	const referenceNext = consumeActionModifiers([effectAgain])[0]!;
	const referenceApply = applyActionModifiers(force, [referenceNext]);

	expect(firstApply).not.toEqual(secondApply);
	expect(secondApply).toEqual(referenceApply);
});

test("Vodka-Zero rejects invalid max variance configuration", () => {
	expect(() => new EffectAimVariance({ typeValue: { maxVarianceDegrees: -1 } })).toThrow("finite non-negative");
	expect(() => new EffectAimVariance({ typeValue: { maxVarianceDegrees: Number.NaN } })).toThrow("finite non-negative");
});
