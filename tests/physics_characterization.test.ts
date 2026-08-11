import { expect, test } from "bun:test";
import { EffectPhysics } from "../src/effects/physics.js";
import { EffectTrigger, EffectType, type FullEffectSettings } from "../src/effects/types.js";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.js";
import { Player } from "../src/entity/Player.js";
import { createPlayerSettings } from "../src/entity/types.js";

function physicsEffect(settings: { friction: number; linearDrag: number; stopThreshold: number }): FullEffectSettings {
	return { ...new EffectPhysics({ typeValue: settings }).toSettings(), trigger: EffectTrigger.Always, triggerValue: [] };
}

test("EffectPhysics applies exponential friction then direction-preserving linear drag", () => {
	const effect = new EffectPhysics({ typeValue: { friction: 1, linearDrag: 2, stopThreshold: 0.01 } });
	const player = new Player(createPlayerSettings({ velocity: { x: 3, y: 4 } }));

	effect.apply(player, { dt: 1, friction: 1 });

	expect(player.getVel().x).toBeCloseTo(1.8);
	expect(player.getVel().y).toBeCloseTo(2.4);
});

test("EffectPhysics uses dt for direct application and zeros below its configured threshold", () => {
	const friction = new EffectPhysics({ typeValue: { friction: 0.5, linearDrag: 0, stopThreshold: 0.1 } });
	const player = new Player(createPlayerSettings({ velocity: { x: 4, y: 0 } }));
	friction.apply(player, { dt: 2, friction: 0.5 });
	expect(player.getVel().x).toBeCloseTo(1);

	const threshold = new EffectPhysics({ typeValue: { friction: 1, linearDrag: 0, stopThreshold: 0.1 } });
	const slow = new Player(createPlayerSettings({ velocity: { x: 0.05, y: 0 } }));
	threshold.apply(slow, { dt: 1, friction: 1 });
	expect(slow.getVel()).toEqual({ x: 0, y: 0 });
});

test("Player-owned EffectPhysics runs after Movement and uses its configured one-tick damping", () => {
	const player = new Player(createPlayerSettings({ velocity: { x: 10, y: 0 }, effects: [
		{ trigger: EffectTrigger.Always, triggerValue: [], schemaVersion: 1, type: EffectType.Movement, typeValue: { deltaTime: 0, x: 0, y: 0 } },
		physicsEffect({ friction: 0.5, linearDrag: 0, stopThreshold: 0.01 }),
	] }));
	const handler = new GameHandlerBuilder().defaultSystems().addPlayer(player).build();

	handler.tick(2);

	expect(player.getPos().x).toBeCloseTo(20);
	expect(player.getVel().x).toBeCloseTo(5);
});

test("world friction does not replace an entity's serialized EffectPhysics configuration", () => {
	const player = new Player(createPlayerSettings({ velocity: { x: 10, y: 0 }, effects: [physicsEffect({ friction: 1, linearDrag: 0, stopThreshold: 0.01 })] }));
	const handler = new GameHandlerBuilder().defaultSystems({ friction: 0.25, linearDrag: 0, stopThreshold: 0.01 }).addPlayer(player).build();

	handler.tick(1);

	expect(player.getVel()).toEqual({ x: 10, y: 0 });
});

test("inactive entities skip EffectPhysics and restored snapshots continue identically", () => {
	const inactive = new Player(createPlayerSettings({ velocity: { x: 10, y: 0 }, effects: [physicsEffect({ friction: 0.5, linearDrag: 0, stopThreshold: 0.01 })] }));
	inactive.setIsDead(true);
	const active = new Player(createPlayerSettings({ velocity: { x: 10, y: 0 }, effects: [physicsEffect({ friction: 0.5, linearDrag: 0, stopThreshold: 0.01 })] }));
	const handler = new GameHandlerBuilder().defaultSystems().addPlayer(inactive).addPlayer(active).build();
	handler.tick(1);
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(handler.toSettings()).build();
	handler.tick(1);
	restored.tick(1);

	expect(inactive.getVel()).toEqual({ x: 0, y: 0 });
	expect(restored.toSettings()).toEqual(handler.toSettings());
});
