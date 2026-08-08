import { expect, test } from "bun:test";
import { kore } from "../src/kore/sdk/index.ts";
import { validateGameSettings } from "../src/settings/settings.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

test("KORE createPlayer remains a complete PlayerSettings authoring boundary", () => {
	const id = "11111111-1111-4111-8111-111111111111";
	const player = kore.createPlayer({ id, teamNr: 1, position: { x: 10, y: 20 }, velocity: { x: 2, y: 0 } });

	expect(player.id).toBe(id);
	expect(player.team).toEqual([1]);
	expect(player.position).toEqual({ x: 10, y: 20 });
	expect(player.velocity).toEqual({ x: 2, y: 0 });
	expect(player.effects).toEqual([]);
	expect(player.inventory).toEqual([]);
});

test("generic state additions do not alter canonical KORE GameSettings", () => {
	const settings = createDefaultGameSettings(2, 1);
	const snapshot = JSON.parse(JSON.stringify(settings));

	validateGameSettings(settings);
	expect(JSON.parse(JSON.stringify(settings))).toEqual(snapshot);
	expect(settings.players[0]).not.toHaveProperty("components");
});
