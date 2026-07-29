import { expect, test } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { applyForceHazard } from "../src/hazards/force.ts";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";

test("force hazards apply a deterministic configured impulse", () => {
	const player = new Player(createPlayerSettings({ mass: 0.5 }));
	applyForceHazard(player, { angle: 90, power: 4 }, new defaultPhysics());
	expect(player.getVel().x).toBeCloseTo(0);
	expect(player.getVel().y).toBe(8);
	expect(() => applyForceHazard(player, { angle: 360, power: 1 }, new defaultPhysics())).toThrow("Invalid force hazard config");
});
