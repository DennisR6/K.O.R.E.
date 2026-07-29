import { expect, test } from "bun:test";
import { validateGameSettings, GameSettings } from "../src/settings/settings.ts";

test("game settings validator rejects malformed numeric, team, structure, and effect data", () => {
	expect(() => validateGameSettings({ ...GameSettings, drift: Number.NaN })).toThrow("Map drift")
	expect(() => validateGameSettings({ ...GameSettings, players: [{ ...GameSettings.players[0], team: [-1] }] })).toThrow("Invalid player")
	expect(() => validateGameSettings({ ...GameSettings, mapBoundarys: [{ ...GameSettings.mapBoundarys[0], x: Infinity }] })).toThrow("Invalid map boundary")
	expect(() => validateGameSettings({ ...GameSettings, effects: [{ type: "bad" }] })).toThrow("Invalid effect")
});
