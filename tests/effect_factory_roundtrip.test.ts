import { describe, expect, test } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { EffectFreeze } from "../src/effects/freeze.ts";
import { EffectGhostMode } from "../src/effects/ghostMode.ts";
import { EffectShield } from "../src/effects/shield.ts";
import { MetaEffect, MultiEffect } from "../src/effects/effects.ts";
import { EffectType, SettingOperation, type EffectSettings } from "../src/effects/types.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";

/**
 * Task 12.11 - Harden The Effect Factory Against Unknown Types.
 *
 * `MetaEffect` rejects unknown effect types instead of silently falling back
 * to movement, `EffectType.Multi` is a real effect that applies and
 * serializes its children, and the freeze/shield/ghost serialized cases
 * round-trip their remaining-state exactly.
 */

const damageSettings: EffectSettings = { schemaVersion: 1, type: EffectType.NumericAdd, typeValue: { stateId: "hp", amount: -5 } };
const physicsSettings: EffectSettings = { schemaVersion: 1, type: EffectType.Physics, typeValue: { friction: 0.98, linearDrag: 0.05, stopThreshold: 0.15 } };
const movementSettings: EffectSettings = { schemaVersion: 1, type: EffectType.Movement, typeValue: { deltaTime: 1, x: 2, y: 3 } };

const allEngineEffects: EffectSettings[] = [
	physicsSettings,
	damageSettings,
	movementSettings,
	{ schemaVersion: 1, type: EffectType.ModifyMass, typeValue: { mass: 3 } },
	{ schemaVersion: 1, type: EffectType.ModifySize, typeValue: { size: 2 } },
	{ schemaVersion: 1, type: EffectType.Position, typeValue: { x: 100, y: 200 } },
	{ schemaVersion: 1, type: EffectType.Velocity, typeValue: { x: 1.5, y: -2 } },
	{ schemaVersion: 1, type: EffectType.Team, typeValue: { team: [1] } },
	{ schemaVersion: 1, type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "hp", value: 20 } },
];

describe("effect factory hardening", () => {
	test("every registered engine effect type round-trips through MetaEffect", () => {
		for (const settings of allEngineEffects) {
			const effect = new MetaEffect(settings);
			expect(effect.getType()).toBe(settings.type);
			expect(effect.toSettings()).toEqual(settings);
		}
	});

	test("unknown effect types are rejected, never silently replaced by movement", () => {
		expect(() => new MetaEffect({ schemaVersion: 1, type: "EffectType.Bogus" as never, typeValue: {} })).toThrow(/Unknown effect type "EffectType.Bogus"/);
		expect(() => new MetaEffect({ schemaVersion: 1, type: undefined as never, typeValue: {} })).toThrow(/Unknown effect type "undefined"/);
		expect(() => new MetaEffect({ schemaVersion: 1, type: null as never, typeValue: {} })).toThrow(/Unknown effect type "null"/);
	});

	test("Multi applies every child in order and round-trips its children", () => {
		const settings: EffectSettings = { schemaVersion: 1, type: EffectType.Multi, typeValue: [damageSettings, movementSettings] };
		const multi = new MetaEffect(settings);
		expect(multi.getType()).toBe(EffectType.Multi);
		expect(multi.toSettings()).toEqual(settings);

		// Both children execute: hp drops and the entity moves.
		const player = new Player(createPlayerSettings({ hp: 10 }));
		new GameHandlerBuilder().defaultSystems().addPlayer(player).build();
		multi.apply(player);
		expect(player.getHP()).toBe(5);
		expect(player.getPos()).toEqual({ x: 2, y: 3 });

		// Nested Multi effects resolve recursively.
		const nested: EffectSettings = { schemaVersion: 1, type: EffectType.Multi, typeValue: [settings, damageSettings] };
		const nestedMulti = new MetaEffect(nested);
		expect(nestedMulti.toSettings()).toEqual(nested);
		const fresh = new Player(createPlayerSettings({ hp: 10 }));
		new GameHandlerBuilder().defaultSystems().addPlayer(fresh).build();
		nestedMulti.apply(fresh);
		expect(fresh.getHP()).toBe(0);
	});

	test("a malformed Multi effect is rejected", () => {
		expect(() => new MetaEffect({ schemaVersion: 1, type: EffectType.Multi, typeValue: { not: "an array" } as never })).toThrow(/requires a typeValue array/);
		expect(() => new MultiEffect({ schemaVersion: 1, type: EffectType.Multi, typeValue: undefined as never })).toThrow(/requires a typeValue array/);
	});

	test("freeze serialized state round-trips including remaining turns", () => {
		const freeze = new EffectFreeze({ typeValue: { speedFactor: 0.25, durationTurns: 3 } });
		freeze.advanceTurn();
		freeze.advanceTurn();
		expect(freeze.getRemainingTurns()).toBe(1);

		const restored = new EffectFreeze(freeze.toSettings() as never);
		expect(restored.toSettings()).toEqual(freeze.toSettings());
		expect(restored.getRemainingTurns()).toBe(1);
		expect(restored.isActive()).toBe(true);
		expect(restored.applyToVelocity({ x: 4, y: 0 })).toEqual({ x: 1, y: 0 });

		// The constructor defaults remainingTurns to the full duration.
		const fresh = new EffectFreeze({ typeValue: { speedFactor: 0.5, durationTurns: 2 } });
		expect(fresh.toSettings()).toEqual({
			type: "freeze",
			typeValue: { speedFactor: 0.5, durationTurns: 2, remainingTurns: 2 },
		});
	});

	test("shield serialized state round-trips including remaining capacity", () => {
		const shield = new EffectShield({ typeValue: { capacity: 10, blocksCollision: true } });
		shield.absorbDamage(6);
		expect(shield.getRemainingCapacity()).toBe(4);

		const restored = new EffectShield(shield.toSettings() as never);
		expect(restored.toSettings()).toEqual(shield.toSettings());
		expect(restored.getRemainingCapacity()).toBe(4);
		expect(restored.absorbDamage(3)).toBe(0);
		expect(restored.getRemainingCapacity()).toBe(1);
	});

	test("ghost mode serialized state round-trips including remaining turns", () => {
		const ghost = new EffectGhostMode({ typeValue: { durationTurns: 2 } });
		ghost.advanceTurn();
		expect(ghost.getRemainingTurns()).toBe(1);

		const restored = new EffectGhostMode(ghost.toSettings() as never);
		expect(restored.toSettings()).toEqual(ghost.toSettings());
		expect(restored.getRemainingTurns()).toBe(1);
		expect(restored.shouldIgnoreCollision()).toBe(true);
		restored.advanceTurn();
		expect(restored.isActive()).toBe(false);
	});
});
