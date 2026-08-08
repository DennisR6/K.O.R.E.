import { describe, expect, test } from "bun:test";
import { EffectShield } from "../src/effects/shield.ts";
import {
	createOfficialItemLoader,
	freezeShotItem,
	FREEZE_SHOT_DURATION_TURNS,
	FREEZE_SHOT_SPEED_FACTOR,
} from "../src/item/officialItems.ts";

/**
 * Cross-system validation 11.8: item-triggered effects must serialize their
 * remaining state and continue correctly after snapshot restoration. The
 * temporal modifiers and shields are the state-carrying effect units of the
 * declarative item pipeline.
 */
describe("Item Effect Snapshot Continuity", () => {
	test("shield serializes its remaining capacity and continues after restoration", () => {
		const shield = new EffectShield({ typeValue: { capacity: 10 } });
		expect(shield.getRemainingCapacity()).toBe(10);
		expect(shield.isActive()).toBe(true);
		expect(shield.shouldBlockCollision()).toBe(true);

		// Absorbed damage reduces the serializable remaining capacity.
		expect(shield.absorbDamage(4)).toBe(0);
		expect(shield.getRemainingCapacity()).toBe(6);
		const restored = new EffectShield(shield.toSettings() as never);
		expect(restored.toSettings()).toEqual(shield.toSettings());
		expect(restored.toSettings().typeValue).toEqual({ capacity: 10, remainingCapacity: 6, blocksCollision: true });

		// The restored shield continues absorbing; overflow damage passes through.
		expect(restored.absorbDamage(5)).toBe(0);
		expect(restored.absorbDamage(6)).toBe(5);
		expect(restored.getRemainingCapacity()).toBe(0);
		expect(restored.isActive()).toBe(false);
		expect(restored.shouldBlockCollision()).toBe(false);
	});

	test("an interrupted shield absorption matches an uninterrupted one", () => {
		const uninterrupted = new EffectShield({ typeValue: { capacity: 10, blocksCollision: false } });
		let interrupted = new EffectShield({ typeValue: { capacity: 10, blocksCollision: false } });
		const damage = [1, 2, 3, 4, 5];
		for (let i = 0; i < damage.length; i++) {
			if (i % 2 === 1) {
				interrupted = new EffectShield(interrupted.toSettings() as never);
			}
			expect(interrupted.absorbDamage(damage[i]!)).toBe(uninterrupted.absorbDamage(damage[i]!));
			expect(interrupted.getRemainingCapacity()).toBe(uninterrupted.getRemainingCapacity());
		}
		expect(interrupted.toSettings().typeValue).toEqual(uninterrupted.toSettings().typeValue);
		expect(interrupted.isActive()).toBe(false);
	});

	test("shield rejects invalid construction and consumption", () => {
		expect(() => new EffectShield({ typeValue: { capacity: 0 } })).toThrow(/capacity/);
		expect(() => new EffectShield({ typeValue: { capacity: -3 } })).toThrow(/capacity/);
		expect(() => new EffectShield({ typeValue: { capacity: 5, remainingCapacity: 6 } })).toThrow(/remainingCapacity/);
		expect(() => new EffectShield({ typeValue: { capacity: 5, blocksCollision: "yes" as never } })).toThrow(/blocksCollision/);
		const shield = new EffectShield({ typeValue: { capacity: 5 } });
		expect(() => shield.absorbDamage(-1)).toThrow(/damage/);
		expect(() => shield.absorbDamage(Number.NaN)).toThrow(/damage/);
	});

	test("the freeze-shot item document matches its runtime effect factory", () => {
		// The declarative document carries the same values the factory applies.
		expect(freezeShotItem.effects).toEqual([{
			type: "temporalModifier",
			value: { durationUnit: "turns", duration: FREEZE_SHOT_DURATION_TURNS, effect: { schemaVersion: 1, type: "movement.scale-speed", typeValue: { factor: FREEZE_SHOT_SPEED_FACTOR } } },
		}]);

		// The loader accepts the built-in document and returns defensive copies.
		const loader = createOfficialItemLoader();
		const loaded = loader.get("freeze-shot");
		expect(loaded).toBeDefined();
		expect(loaded?.id).toBe("freeze-shot");
		expect(loaded?.effects).toEqual(freezeShotItem.effects);
		const secondLoad = loader.get("freeze-shot");
		expect(secondLoad).not.toBe(loaded);

	});
});
