import { describe, expect, test } from "bun:test";
import { EffectDamage } from "../src/effects/damage.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { EffectTrigger, EffectType } from "../src/effects/types.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { WinningSystem } from "../src/systems/WinningSystem.ts";

function damage(amount: number): EffectDamage {
	return new EffectDamage({ typeValue: { damage: amount } });
}

function player(hp = 30): Player {
	return new Player(createPlayerSettings({ hp, velocity: { x: 4, y: -2 } }));
}

describe("legacy Damage observable contract", () => {
	test("damage below remaining HP only mutates HP", () => {
		const target = player();

		damage(10).apply(target);

		expect(target.getHP()).toBe(20);
		expect(target.isDead()).toBe(false);
		expect(target.physicsEnabled()).toBe(true);
		expect(target.drawingEnabled()).toBe(true);
		expect(target.getVel()).toEqual({ x: 4, y: -2 });
	});

	test.each([
		[30, 0],
		[40, -10],
	])("damage at or beyond HP depletion preserves raw HP and eliminates immediately", (amount, expectedHp) => {
		const target = player();

		damage(amount).apply(target);

		expect(target.getHP()).toBe(expectedHp);
		expect(target.isDead()).toBe(true);
		expect(target.physicsEnabled()).toBe(false);
		expect(target.drawingEnabled()).toBe(false);
		expect(target.getVel()).toEqual({ x: 0, y: 0 });
	});

	test("repeated damage after elimination continues raw HP mutation and remains eliminated", () => {
		const target = player();
		damage(30).apply(target);

		damage(5).apply(target);

		expect(target.getHP()).toBe(-5);
		expect(target.isDead()).toBe(true);
		expect(target.physicsEnabled()).toBe(false);
		expect(target.drawingEnabled()).toBe(false);
	});

	test("partial and eliminated HP round-trip through PlayerSettings", () => {
		const partial = player();
		damage(10).apply(partial);
		const partialRestored = new Player(partial.toSettings());

		const eliminated = player();
		damage(40).apply(eliminated);
		const eliminatedRestored = new Player(eliminated.toSettings());

		expect(partialRestored.toSettings()).toEqual(partial.toSettings());
		expect(eliminatedRestored.toSettings()).toEqual(eliminated.toSettings());
	});

	test("collision Damage is reproduced by replayed authoritative simulation", () => {
		const settings = createDefaultGameSettings(2, 1);
		settings.players[0]!.position = { x: 400, y: 225 };
		settings.players[1]!.position = { x: 400, y: 225 };
		settings.players[0]!.effects = [{
			schemaVersion: 1,
			trigger: EffectTrigger.Collision,
			triggerValue: [],
			type: EffectType.Damage,
			typeValue: { damage: 30 },
		}];

		const handler = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(new WinningSystem(2))
			.fromSettings(settings)
			.build();
		const emitter = new GameEmitter(handler, settings.gameMode!, 2, 42);
		emitter.sendShot(settings.players[0]!.id, 0, 1);
		while (handler.getState() === GameState.Playing) handler.tick();

		const replay = new ReplayPlayer(emitter.recorder.getReplay());
		replay.playAll();

		expect(handler.getEntityManager().toSettings()).toEqual(replay.getHandler().getEntityManager().toSettings());
		expect(replay.getHandler().getEntityManager().getEntities()[1]!.getHP()).toBe(0);
		expect(replay.getHandler().getEntityManager().getEntities()[1]!.isDead()).toBe(true);
	});
});
