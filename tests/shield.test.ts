import { expect, test } from "bun:test";
import { EffectShield } from "../src/effects/shield.ts";
import { ItemEffectType } from "../src/effects/types.ts";

test("shield absorbs damage until its capacity is exhausted", () => {
	const shield = new EffectShield({ typeValue: { capacity: 5 } });
	expect(shield.absorbDamage(3)).toBe(0);
	expect(shield.getRemainingCapacity()).toBe(2);
	expect(shield.absorbDamage(4)).toBe(2);
	expect(shield.isActive()).toBe(false);
	expect(shield.shouldBlockCollision()).toBe(false);
});

test("shield blocks collisions while active and restores serialized state", () => {
	const shield = new EffectShield({ typeValue: { capacity: 10, blocksCollision: true } });
	shield.absorbDamage(4);
	expect(shield.shouldBlockCollision()).toBe(true);
	const settings = shield.toSettings();
	expect(settings).toEqual({ type: ItemEffectType.Shield, typeValue: { capacity: 10, remainingCapacity: 6, blocksCollision: true } });
	expect(new EffectShield(settings).toSettings()).toEqual(settings);
});

test("shield validates capacity, damage, and collision configuration", () => {
	expect(() => new EffectShield({ typeValue: { capacity: 0 } })).toThrow("positive");
	expect(() => new EffectShield({ typeValue: { capacity: 2, remainingCapacity: 3 } })).toThrow("between zero");
	expect(() => new EffectShield({ typeValue: { capacity: 2, blocksCollision: "yes" as unknown as boolean } })).toThrow("boolean");
	const shield = new EffectShield({ typeValue: { capacity: 2 } });
	expect(() => shield.absorbDamage(-1)).toThrow("non-negative");
});
