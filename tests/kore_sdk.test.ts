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

test("SDK hazard descriptors preserve canonical documents and direct runtime behavior", () => {
	const map = kore.createDefaultMap({ id: "22222222-2222-4222-8222-222222222222", name: "Hazard SDK" })
		.addPlayerSpawn({ x: 40, y: 130, w: 180, h: 180, teamNr: 0, playerCount: 1 })
		.addPlayerSpawn({ x: 580, y: 130, w: 180, h: 180, teamNr: 1, playerCount: 1 })
		.addForceZone({ id: "vent", x: 300, y: 225, r: 20, angle: 90, power: 2 })
		.addKillZone({ id: "lava", x: 500, y: 225, r: 18 });

	const document = map.buildMapDocument();
	const settings = map.build();
	validateMapDocument(document);
	validateGameSettings(settings);
	expect(document.hazards.map(hazard => hazard.type)).toEqual(["force", "kill-zone"]);
	expect(settings.mapBoundarys.filter(boundary => boundary.x === 300 || boundary.x === 500)).toHaveLength(2);
	expect(JSON.parse(map.buildJson())).toEqual(settings);
	expect(() => map.addKillZone({ id: "lava", x: 1, y: 1, r: 2 })).toThrow("already registered");
	expect(() => map.addForceZone({ id: "bad", x: 1, y: 1, r: 2, angle: 360, power: 1 })).toThrow("angle");
});
