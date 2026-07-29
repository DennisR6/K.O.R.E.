import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { StructureRectangle } from "../src/structures/structureRectangle.ts";
import { StructureCircle } from "../src/structures/structureCircle.ts";

test("a player outside an inferred outer boundary dies on that tick", () => {
	const player = new Player(createPlayerSettings({ position: { x: 95, y: 50 }, size: 10 }));
	player.setVel({ x: 1, y: 0 });
	new GameHandlerBuilder().defaultSystems()
		.addStructure(new StructureRectangle(0, 0, 100, 100))
		.addStructure(new StructureCircle(50, 50, 1, undefined, []))
		.addPlayer(player)
		.build()
		.tick();
	expect(player.isDead()).toBe(true);
	expect(player.getVel()).toEqual({ x: 0, y: 0 });
});

test("a player inside an inferred outer boundary remains active", () => {
	const player = new Player(createPlayerSettings({ position: { x: 50, y: 50 }, size: 10 }));
	new GameHandlerBuilder().defaultSystems()
		.addStructure(new StructureRectangle(0, 0, 100, 100))
		.addStructure(new StructureCircle(50, 50, 1, undefined, []))
		.addPlayer(player)
		.build()
		.tick();
	expect(player.isDead()).toBe(false);
});
