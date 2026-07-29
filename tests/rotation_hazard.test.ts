import { expect, test } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { applyRotationHazard } from "../src/hazards/rotation.ts";

test("rotation hazards add configured degrees and normalize serialized rotation", () => {
	const player = new Player(createPlayerSettings({ rotation: 350 }));
	applyRotationHazard(player, { degrees: 20 });
	expect(player.toSettings().rotation).toBe(10);
	applyRotationHazard(player, { degrees: -30 });
	expect(player.toSettings().rotation).toBe(340);
	expect(() => applyRotationHazard(player, { degrees: Number.NaN })).toThrow("Invalid rotation hazard config");
});
