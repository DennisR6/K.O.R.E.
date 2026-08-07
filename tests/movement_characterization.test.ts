import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { EffectMove } from "../src/effects/movement.ts";
import { EffectTrigger, type FullEffectSettings } from "../src/effects/types.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

function movementEffect(typeValue: { deltaTime: number; x: number; y: number }): FullEffectSettings {
	return {
		...new EffectMove({ typeValue }).toSettings(),
		trigger: EffectTrigger.Always,
		triggerValue: [],
	};
}

test("movement does not mutate a player without an Always Movement effect", () => {
	const player = new Player(createPlayerSettings({ position: { x: 10, y: 20 }, velocity: { x: 3, y: -2 }, effects: [] }));

	player.tick(2, 0.995);

	expect(player.getPos()).toEqual({ x: 10, y: 20 });
	expect(player.getVel()).toEqual({ x: 3, y: -2 });
});

test("movement uses runtime velocity and tick delta when the effect payload is zero", () => {
	const player = new Player(createPlayerSettings({
		position: { x: 10, y: 20 },
		velocity: { x: 3, y: -2 },
		effects: [movementEffect({ deltaTime: 0, x: 0, y: 0 })],
	}));
	const handler = new GameHandlerBuilder().defaultSystems().addPlayer(player).build();

	handler.tick(2);

	expect(player.getPos()).toEqual({ x: 16, y: 16 });
});

test("movement payload values override runtime values independently", () => {
	const player = new Player(createPlayerSettings({
		position: { x: 10, y: 20 },
		velocity: { x: 3, y: -2 },
		effects: [movementEffect({ deltaTime: 0.5, x: 4, y: 0 })],
	}));
	const handler = new GameHandlerBuilder().defaultSystems().addPlayer(player).build();

	handler.tick(2);

	expect(player.getPos()).toEqual({ x: 12, y: 19 });
});

test("stacked movement effects apply in declaration order and persist in snapshots", () => {
	const settings = createPlayerSettings({
		position: { x: 0, y: 0 },
		velocity: { x: 1, y: 1 },
		effects: [
			movementEffect({ deltaTime: 1, x: 1, y: 0 }),
			movementEffect({ deltaTime: 1, x: 0, y: 2 }),
		],
	});
	const handler = new GameHandlerBuilder().defaultSystems().addPlayer(new Player(settings)).build();

	handler.tick(1);
	const restoredHandler = new GameHandlerBuilder().defaultSystems().fromSettings(handler.toSettings()).build();
	restoredHandler.tick(1);

	expect(handler.getEntityManager().getEntities()[0]!.getPos()).toEqual({ x: 2, y: 3 });
	expect(restoredHandler.getEntityManager().getEntities()[0]!.getPos()).toEqual({ x: 4, y: 6 });
});

test("movement drift preserves speed while steering toward rotation", () => {
	const gameSettings = createDefaultGameSettings(1, 1);
	gameSettings.drift = 0.5;
	gameSettings.players = [createPlayerSettings({
		position: { x: 0, y: 0 },
		velocity: { x: 0, y: 10 },
		rotation: 0,
		effects: [movementEffect({ deltaTime: 1, x: 0, y: 0 })],
	})];
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(gameSettings).build();
	const player = handler.getEntityManager().getEntities()[0]!;

	handler.tick(1);

	const velocity = player.getVel();
	expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(10);
	expect(velocity.x).toBeGreaterThan(0);
	expect(player.getPos().x).toBeCloseTo(velocity.x);
	expect(player.getPos().y).toBeCloseTo(velocity.y);
});

test("simulated movement and playback produce the same final state", () => {
	const player = createPlayerSettings({
		position: { x: 100, y: 100 },
		velocity: { x: 0, y: 0 },
		effects: [movementEffect({ deltaTime: 0, x: 0, y: 0 })],
	});
	const handler = new GameHandlerBuilder().defaultSystems().addPlayer(new Player(player)).build();
	const simulation = handler.simulateTurn(player.id, 0, 5);

	handler.playTurn(simulation);
	for (let frame = 0; frame < simulation.durationFrames; frame++) handler.tick();

	expect(handler.getEntityManager().getEntities()[0]?.getPos()).toEqual(simulation.finalState[0]?.position);
});
