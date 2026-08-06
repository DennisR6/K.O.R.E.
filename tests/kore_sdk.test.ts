import { expect, test } from "bun:test";
import { validateMapDocument } from "../src/contracts/documents.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { kore } from "../src/kore_sdk.ts";
import { validateGameSettings } from "../src/settings/settings.ts";

test("single kore SDK export builds JSON-safe settings accepted by the engine", () => {
	const penguins = kore.createTeam({ teamNr: 0, name: "Penguins", color: "#0ea5e9", playerCount: 2 });
	const map = kore.createDefaultMap({ id: "11111111-1111-4111-8111-111111111111", name: "SDK Arena" })
		.addBackground({ type: "url", url: "https://example.test/arena.png" })
		.addTeam(penguins)
		.addPlayerSpawn({ x: 40, y: 130, w: 180, h: 180, team: penguins })
		.addPlayerSpawn({ x: 580, y: 130, w: 180, h: 180, teamNr: 1, playerCount: 2 })
		.addRectangle({ x: 380, y: 160, w: 40, h: 130, color: "#334155" })
		.addWorldEffects({ effects: [kore.effects.move({ deltaTime: 0, x: 0, y: 0 }), kore.effects.physics(kore.types.friction.ice)] });
	const settings = map.build();
	const json = map.buildJson();

	expect(() => validateGameSettings(settings)).not.toThrow();
	expect(JSON.parse(json)).toEqual(settings);
	expect(settings.background).toEqual({ type: "image", url: "https://example.test/arena.png" });
	expect(settings.players).toHaveLength(4);
	expect(settings.effects).toHaveLength(2);
	expect(() => new GameHandlerBuilder().defaultSystems().fromSettings(settings).build()).not.toThrow();
	expect(() => validateMapDocument(map.buildMapDocument())).not.toThrow();
});

test("SDK rejects unplayable team layouts and unsafe background protocols", () => {
	expect(() => kore.createDefaultMap().addBackground({ type: "url", url: "javascript:alert(1)" })).toThrow();
	expect(() => kore.createDefaultMap()
		.addPlayerSpawn({ x: 0, y: 0, w: 100, h: 100, teamNr: 0, playerCount: 1 })
		.addPlayerSpawn({ x: 700, y: 0, w: 100, h: 100, teamNr: 1, playerCount: 2 })
		.build()).toThrow("same figure count");
});
