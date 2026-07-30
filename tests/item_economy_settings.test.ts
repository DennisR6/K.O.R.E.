import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { currentTurnMode } from "../src/rules/defaultGameModes.ts";
import { validateItemEconomySettings, type ItemEconomySettings } from "../src/rules/types.ts";
import { createItemDocument } from "../src/item/types.ts";
import { createDefaultGameSettings, validateGameSettings } from "../src/settings/settings.ts";

const economy: ItemEconomySettings = {
	fixedLoadouts: [{ team: 0, items: [{ itemId: "anker", uses: 2 }] }],
	mapPickups: [{ itemId: "magnet", spawnRegion: { x: 10, y: 20, w: 30, h: 40 }, activationType: "collision" }],
	randomDraw: { seed: 1234, itemIds: ["dash", "freeze"], drawsPerTurn: 1 },
};

test("item economy serializes fixed loadouts, pickups, and seeded draws in game snapshots", () => {
	const settings = {
		...createDefaultGameSettings(),
		items: [createItemDocument({ id: "anker" }), createItemDocument({ id: "dash" }), createItemDocument({ id: "freeze" })],
		gameMode: { ...currentTurnMode, itemEconomy: economy },
	};
	validateGameSettings(settings);
	const snapshot = JSON.parse(JSON.stringify(new GameHandlerBuilder().defaultSystems().fromSettings(settings).build().toSettings()));
	expect(snapshot.gameMode.itemEconomy).toEqual(economy);
});

test("item economy rejects ambiguous loadouts and invalid seeded draws", () => {
	expect(() => validateItemEconomySettings({ ...economy, fixedLoadouts: [...economy.fixedLoadouts, { team: 0, items: [] }] })).toThrow("one loadout per team");
	expect(() => validateItemEconomySettings({ ...economy, mapPickups: [{ ...economy.mapPickups[0], spawnRegion: { x: 0, y: 0, w: 0, h: 1 } }] })).toThrow("w and h must be positive");
	expect(() => validateItemEconomySettings({ ...economy, randomDraw: { seed: 1.5, itemIds: [], drawsPerTurn: 0 } })).toThrow("Seeded item draws");
});
