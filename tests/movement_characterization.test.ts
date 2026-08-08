import { expect, test } from "bun:test";
import { EffectMove } from "../src/effects/movement.js";
import { EffectPhysics } from "../src/effects/physics.js";
import { EffectTrigger, type FullEffectSettings } from "../src/effects/types.js";
import { GameHandlerBuilder } from "../src/engine/Handler.js";
import { createPlayerSettings } from "../src/entity/types.js";
import { Player } from "../src/entity/Player.js";

function movementEffects(options: { friction?: number; linearDrag?: number; stopThreshold?: number } = {}): FullEffectSettings[] {
	return [
		{ trigger: EffectTrigger.Always, triggerValue: [] as [], ...new EffectMove({ typeValue: { deltaTime: 0, x: 0, y: 0 } }).toSettings() },
		{ trigger: EffectTrigger.Always, triggerValue: [] as [], ...new EffectPhysics({ typeValue: { friction: options.friction ?? 1, linearDrag: options.linearDrag ?? 0, stopThreshold: options.stopThreshold ?? 0.01 } }).toSettings() },
	];
}

test("legacy Movement integrates position before entity friction and honors dt", () => {
	const player = new Player(createPlayerSettings({ position: { x: 5, y: 7 }, velocity: { x: 10, y: -4 }, effects: movementEffects({ friction: 0.5 }) }));
	const handler = new GameHandlerBuilder().defaultSystems().addPlayer(player).build();

	handler.tick(2);

	expect(player.getPos().x).toBeCloseTo(25);
	expect(player.getPos().y).toBeCloseTo(-1);
	expect(player.getVel().x).toBeCloseTo(5);
	expect(player.getVel().y).toBeCloseTo(-2);
});

test("legacy Movement applies drift to velocity but preserves speed", () => {
	const player = new Player(createPlayerSettings({ velocity: { x: 10, y: 0 }, rotation: 90, effects: movementEffects() }));
	const settings = { ...new GameHandlerBuilder().defaultSystems().addPlayer(player).build().toSettings(), drift: 1 };
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();

	handler.tick(1);

	expect(handler.getEntityManager().getEntities()[0]!.getVel().x).toBeCloseTo(0, 8);
	expect(handler.getEntityManager().getEntities()[0]!.getVel().y).toBeCloseTo(10, 8);
	expect(handler.getEntityManager().getEntities()[0]!.getPos().x).toBeCloseTo(0, 8);
	expect(handler.getEntityManager().getEntities()[0]!.getPos().y).toBeCloseTo(10, 8);
});

test("legacy Movement skips inactive entities and preserves zero-velocity position", () => {
	const inactive = new Player(createPlayerSettings({ position: { x: 3, y: 4 }, velocity: { x: 10, y: 10 }, effects: movementEffects() }));
	inactive.setIsDead(true);
	const stationary = new Player(createPlayerSettings({ position: { x: 8, y: 9 }, velocity: { x: 0, y: 0 }, effects: movementEffects() }));
	const handler = new GameHandlerBuilder().defaultSystems().addPlayer(inactive).addPlayer(stationary).build();

	handler.tick(3);

	expect(inactive.getPos()).toEqual({ x: 3, y: 4 });
	expect(stationary.getPos()).toEqual({ x: 8, y: 9 });
});

test("legacy Movement continues identically after snapshot restoration", () => {
	const player = new Player(createPlayerSettings({ velocity: { x: 4, y: 2 }, effects: movementEffects() }));
	const handler = new GameHandlerBuilder().defaultSystems().addPlayer(player).build();
	handler.tick(1);
	const snapshot = handler.toSettings();
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();

	handler.tick(1);
	restored.tick(1);

	expect(restored.toSettings()).toEqual(handler.toSettings());
});
