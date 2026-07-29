import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { EffectMove } from "../src/effects/movement.ts";
import { EffectTrigger } from "../src/effects/types.ts";
import { GameSettings } from "../src/settings/settings.ts";

function createDriftHandler(velocity: { x: number, y: number }, drift: number) {
	const movement = new EffectMove({ typeValue: { x: 0, y: 0, deltaTime: 0 } }).toSettings();
	const player = createPlayerSettings({
		position: { x: 0, y: 0 },
		velocity,
		rotation: 0,
		effects: [{ trigger: EffectTrigger.Always, triggerValue: [], ...movement }],
	});
	return new GameHandlerBuilder().defaultSystems().fromSettings({
		...GameSettings,
		drift,
		friction: { friction: 1, linearDrag: 0, stopThreshold: 0.1 },
		mapBoundarys: [],
		players: [player],
	}).build();
}

test("map drift deterministically steers moving velocity while preserving speed", () => {
	const handler = createDriftHandler({ x: 0, y: 10 }, 0.25);
	for (let frame = 0; frame < 3; frame++) handler.tick();
	const player = handler.getEntityManager().getEntities()[0];

	expect(player.getVel()).toEqual({ x: 7.364649810826372, y: 6.764756696577866 });
	expect(player.getPos()).toEqual({ x: 16.176503284801715, y: 24.502789173159158 });
	expect(Math.hypot(player.getVel().x, player.getVel().y)).toBe(10);
});

test("map drift does not steer velocity at the stop threshold", () => {
	const handler = createDriftHandler({ x: 0, y: 0.1 }, 1);
	handler.tick();
	const player = handler.getEntityManager().getEntities()[0];

	expect(player.getVel()).toEqual({ x: 0, y: 0.1 });
	expect(player.getPos()).toEqual({ x: 0, y: 0.1 });
});
