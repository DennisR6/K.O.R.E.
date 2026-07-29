import { expect, test } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { applyKillZoneHazard } from "../src/hazards/killZone.ts";

test("kill-zone hazards use shared player elimination", () => {
	const player = new Player(createPlayerSettings({ velocity: { x: 3, y: -2 } }));
	applyKillZoneHazard(player);
	expect(player.isDead()).toBe(true);
	expect(player.getVel()).toEqual({ x: 0, y: 0 });
});
