import { describe, expect, test } from "bun:test";
import { kore } from "../src/kore/sdk/index.js";
import { createRuntimeEffect } from "../src/effects/runtimeFactory.js";
import { MetaEffect } from "../src/effects/effects.js";
import { EffectType, ItemEffectType, EffectTrigger } from "../src/effects/types.js";
import { FRICTION_TABLE } from "../src/settings/settings.js";

describe("Effect SDK Authoring & Migration Parity", () => {

	describe("SDK Core Effect Helpers", () => {
		test("kore.effects.damage produces JSON-safe numeric.add settings", () => {
			const effect = kore.effects.damage(25);
			expect(effect.toSettings()).toEqual({
				schemaVersion: 1,
				type: EffectType.NumericAdd,
				typeValue: { stateId: "hp", amount: -25 },
			});
			expect(JSON.parse(JSON.stringify(effect.toSettings()))).toEqual(effect.toSettings());
		});

		test("kore.effects.mass produces valid EffectModifyMass settings", () => {
			const effect = kore.effects.mass(2);
			expect(effect.toSettings()).toEqual({
				schemaVersion: 1,
				type: EffectType.ModifyMass,
				typeValue: { mass: 2 },
			});
		});

		test("kore.effects.size produces valid ModifySize settings", () => {
			const effect = kore.effects.size(30);
			expect(effect).toEqual({
				schemaVersion: 1,
				type: EffectType.ModifySize,
				typeValue: { size: 30 },
			});
		});

		test("kore.effects.position produces valid Position settings", () => {
			const effect = kore.effects.position({ x: 100, y: 200 });
			expect(effect).toEqual({
				schemaVersion: 1,
				type: EffectType.Position,
				typeValue: { x: 100, y: 200 },
			});
		});

		test("kore.effects.velocity produces valid Velocity settings", () => {
			const effect = kore.effects.velocity({ x: 15, y: -5 });
			expect(effect).toEqual({
				schemaVersion: 1,
				type: EffectType.Velocity,
				typeValue: { x: 15, y: -5 },
			});
		});

		test("kore.effects.team produces valid Team settings", () => {
			const effect = kore.effects.team([0, 1]);
			expect(effect).toEqual({
				schemaVersion: 1,
				type: EffectType.Team,
				typeValue: { team: [0, 1] },
			});
		});

		test("kore.effects.multi combines multiple sub-effects", () => {
			const damage = kore.effects.damage(10);
			const mass = kore.effects.mass(1.5);
			const multi = kore.effects.multi(damage, mass);

			expect(multi.toSettings()).toEqual({
				schemaVersion: 1,
				type: EffectType.Multi,
				typeValue: [
					{ schemaVersion: 1, type: EffectType.NumericAdd, typeValue: { stateId: "hp", amount: -10 } },
					{ schemaVersion: 1, type: EffectType.ModifyMass, typeValue: { mass: 1.5 } },
				],
			});
		});

		test("validation rejects invalid parameters", () => {
			expect(() => kore.effects.damage(-5)).toThrow("Damage must be a non-negative finite number");
			expect(() => kore.effects.mass(0)).toThrow("Mass must be a finite positive number");
			expect(() => kore.effects.size(-1)).toThrow("Size must be a finite positive number");
			expect(() => kore.effects.position({ x: NaN, y: 0 })).toThrow("Position coordinates must be finite numbers");
		});
	});

	describe("SDK Item Effect Helpers", () => {
		test("kore.effects.shield produces valid Shield item effect settings", () => {
			const effect = kore.effects.shield(50);
			expect(effect).toEqual({
				type: ItemEffectType.Shield,
				typeValue: { capacity: 50 },
			});
		});

		test("kore.effects.freeze produces valid Freeze item effect settings", () => {
			const effect = kore.effects.freeze(2);
			expect(effect).toEqual({
				type: ItemEffectType.Freeze,
				typeValue: { durationTurns: 2 },
			});
		});

		test("kore.effects.magnet produces valid Magnet item effect settings", () => {
			const effect = kore.effects.magnet(500, 120);
			expect(effect).toEqual({
				type: ItemEffectType.Magnet,
				typeValue: { strength: 500, range: 120 },
			});
		});

		test("kore.effects.temporaryWall produces valid TemporaryWall item effect settings", () => {
			const effect = kore.effects.temporaryWall(3);
			expect(effect).toEqual({
				type: ItemEffectType.TemporaryWall,
				typeValue: { lifetimeTurns: 3 },
			});
		});

		test("kore.effects.ghostMode produces valid GhostMode item effect settings", () => {
			const effect = kore.effects.ghostMode(1);
			expect(effect).toEqual({
				type: ItemEffectType.GhostMode,
				typeValue: { durationTurns: 1 },
			});
		});

		test("kore.effects.modifyForce produces valid ModifyForce item effect settings", () => {
			const effect = kore.effects.modifyForce(1.5);
			expect(effect).toEqual({
				type: ItemEffectType.ModifyForce,
				typeValue: { multiplier: 1.5 },
			});
		});

		test("kore.effects.delayedEffect produces nested item effect settings", () => {
			const inner = kore.effects.shield(30);
			const delayed = kore.effects.delayedEffect(10, inner);
			expect(delayed).toEqual({
				type: ItemEffectType.DelayedEffect,
				typeValue: { delayTicks: 10, effectType: inner.type, effectValue: inner.typeValue },
			});
		});
	});

	describe("Runtime Effect Factory & Parity", () => {
		test("createRuntimeEffect constructs a valid Effect instance", () => {
			const settings = kore.effects.damage(15).toSettings();
			const runtimeEffect = createRuntimeEffect(settings);

			expect(runtimeEffect.getType()).toBe(EffectType.NumericAdd);
			expect(runtimeEffect.toSettings()).toEqual(settings);
		});

		test("new MetaEffect(settings) vs createRuntimeEffect(settings) behavior parity", () => {
			const settings = kore.effects.mass(2).toSettings();
			const legacyEffect = new MetaEffect(settings);
			const factoryEffect = createRuntimeEffect(settings);

			expect(factoryEffect.toSettings()).toEqual(legacyEffect.toSettings());
		});
	});
});
