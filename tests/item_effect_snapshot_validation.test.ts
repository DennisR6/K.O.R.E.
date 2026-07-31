import { describe, expect, test } from "bun:test";
import { EffectFreeze } from "../src/effects/freeze.ts";
import { EffectShield } from "../src/effects/shield.ts";
import { ItemEffectType } from "../src/effects/types.ts";
import {
	createFreezeShot,
	createOfficialItemLoader,
	freezeShotItem,
	FREEZE_SHOT_DURATION_TURNS,
	FREEZE_SHOT_SPEED_FACTOR,
} from "../src/item/officialItems.ts";

/**
 * Cross-system validation 11.8: item-triggered effects must serialize their
 * remaining state and continue correctly after snapshot restoration. The
 * freeze and shield primitives are the state-carrying effect units of the
 * declarative item pipeline.
 */
describe("Item Effect Snapshot Continuity", () => {
	test("freeze serializes its remaining turns and continues after restoration", () => {
		const freeze = createFreezeShot();
		expect(freeze.getRemainingTurns()).toBe(FREEZE_SHOT_DURATION_TURNS);
		expect(freeze.toSettings().typeValue).toEqual({
			speedFactor: FREEZE_SHOT_SPEED_FACTOR,
			durationTurns: FREEZE_SHOT_DURATION_TURNS,
			remainingTurns: FREEZE_SHOT_DURATION_TURNS,
		});

		// Active freeze scales velocities deterministically.
		expect(freeze.applyToVelocity({ x: 100, y: -40 })).toEqual({ x: 25, y: -10 });

		// Consume one turn, snapshot, and restore mid-flight.
		freeze.advanceTurn();
		expect(freeze.getRemainingTurns()).toBe(1);
		const restored = new EffectFreeze(freeze.toSettings() as never);
		expect(restored.toSettings()).toEqual(freeze.toSettings());
		expect(restored.applyToVelocity({ x: 8, y: 0 })).toEqual({ x: 2, y: 0 });

		// The restored effect continues to the same expiration point as the
		// uninterrupted effect: one more turn renders it inactive.
		restored.advanceTurn();
		expect(restored.getRemainingTurns()).toBe(0);
		expect(restored.isActive()).toBe(false);
		const passthrough = { x: 50, y: 25 };
		expect(restored.applyToVelocity(passthrough)).toEqual(passthrough);
	});

	test("an interrupted freeze countdown matches an uninterrupted one", () => {
		const uninterrupted = createFreezeShot();
		let interrupted = createFreezeShot();
		for (let turn = 0; turn < 5; turn++) {
			// Every second turn the interrupted effect is serialized and rebuilt
			// from its snapshot, exactly like a persisted game restore.
			if (turn % 2 === 1) {
				interrupted = new EffectFreeze(interrupted.toSettings() as never);
			}
			uninterrupted.advanceTurn();
			interrupted.advanceTurn();
			expect(interrupted.getRemainingTurns()).toBe(uninterrupted.getRemainingTurns());
			expect(interrupted.isActive()).toBe(uninterrupted.isActive());
		}
		expect(interrupted.getRemainingTurns()).toBe(0);
		expect(interrupted.toSettings().typeValue).toEqual(uninterrupted.toSettings().typeValue);
	});

	test("freeze rejects invalid construction and consumption", () => {
		expect(() => new EffectFreeze({ typeValue: { speedFactor: 1.5, durationTurns: 2 } })).toThrow(/speedFactor/);
		expect(() => new EffectFreeze({ typeValue: { speedFactor: 0.5, durationTurns: 0 } })).toThrow(/durationTurns/);
		expect(() => new EffectFreeze({ typeValue: { speedFactor: 0.5, durationTurns: 2, remainingTurns: 3 } })).toThrow(/remainingTurns/);
		expect(() => new EffectFreeze({ typeValue: { speedFactor: 0.5, durationTurns: 2, remainingTurns: -1 } })).toThrow(/remainingTurns/);
		expect(() => new EffectFreeze({ typeValue: { speedFactor: 0.5, durationTurns: 2 } }).applyToVelocity({ x: Number.NaN, y: 0 })).toThrow(/finite/);
	});

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
		expect(freezeShotItem.effects).toEqual([
			{ type: "freeze", value: { speedFactor: FREEZE_SHOT_SPEED_FACTOR, durationTurns: FREEZE_SHOT_DURATION_TURNS } },
		]);
		expect(createFreezeShot().toSettings().type).toBe(ItemEffectType.Freeze);
		expect(createFreezeShot().toSettings().typeValue).toEqual({
			speedFactor: FREEZE_SHOT_SPEED_FACTOR,
			durationTurns: FREEZE_SHOT_DURATION_TURNS,
			remainingTurns: FREEZE_SHOT_DURATION_TURNS,
		});

		// The loader accepts the built-in document and returns defensive copies.
		const loader = createOfficialItemLoader();
		const loaded = loader.get("freeze-shot");
		expect(loaded).toBeDefined();
		expect(loaded?.id).toBe("freeze-shot");
		expect(loaded?.effects).toEqual(freezeShotItem.effects);
		const secondLoad = loader.get("freeze-shot");
		expect(secondLoad).not.toBe(loaded);

		// A document value restored through the validator constructs the same
		// runtime effect, including an explicit remaining-turns snapshot.
		const snapshot = createFreezeShot().toSettings();
		snapshot.typeValue = { ...snapshot.typeValue, remainingTurns: 1 };
		const restored = new EffectFreeze({ typeValue: snapshot.typeValue } as never);
		expect(restored.getRemainingTurns()).toBe(1);
		expect(restored.applyToVelocity({ x: 40, y: 0 })).toEqual({ x: 10, y: 0 });
	});
});
