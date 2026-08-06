import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";

test("dead players do not move, collide, or accept selection", () => {
	const dead = new Player(createPlayerSettings({ position: { x: 0, y: 0 }, size: 10 }));
	const active = new Player(createPlayerSettings({ position: { x: 15, y: 0 }, size: 10 }));
	dead.setIsDead(true);
	dead.setVel({ x: 2, y: 0 });
	active.setVel({ x: -1, y: 0 });
	const handler = new GameHandlerBuilder().defaultSystems().addPlayer([dead, active]).build();

	handler.tick();

	expect(dead.getPos()).toEqual({ x: 0, y: 0 });
	expect(active.getVel()).toEqual({ x: -1, y: 0 });
	expect(handler.getEntityManager().getEntityAt(0, 0)).toBeUndefined();
});

test("dead players cannot resolve turns and remain dead after serialization", () => {
	const player = new Player(createPlayerSettings({ position: { x: 0, y: 0 } }));
	player.setIsDead(true);
	const handler = new GameHandlerBuilder().defaultSystems().addPlayer(player).build();

	expect(() => handler.resolveTurn({ actorId: player.getId(), angle: 0, power: 1 })).toThrow(`Actor ${player.getId()} is not active`);
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(handler.toSettings()).build();
	expect(restored.getEntityManager().getEntityById(player.getId())?.toSettings()).toEqual(player.toSettings());
});
