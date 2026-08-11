import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { StructureCircle } from "../src/structures/structureCircle.ts";

function player(x: number, velocity: number) {
	const result = new Player(createPlayerSettings({ position: { x, y: 0 }, size: 10 }));
	result.setVel({ x: velocity, y: 0 });
	return result;
}

test("disabled entities do not alter active entity velocity", () => {
	const active = player(9, -1);
	const disabled = player(0, 0);
	disabled.setPhysicsEnabled(false);
	new GameHandlerBuilder().defaultSystems().addPlayer(active).addPlayer(disabled).build().tick();
	expect(active.getVel()).toEqual({ x: -1, y: 0 });
});

test("disabled structures do not alter active entity velocity", () => {
	const active = player(9, -1);
	const disabled = new StructureCircle(0, 0, 10, undefined, []);
	disabled.setPhysicsEnabled(false);
	new GameHandlerBuilder().defaultSystems().addPlayer(active).addStructure(disabled).build().tick();
	expect(active.getVel()).toEqual({ x: -1, y: 0 });
});
