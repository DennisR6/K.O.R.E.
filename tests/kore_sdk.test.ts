import { expect, test } from "bun:test";
import { validateMapDocument } from "../src/contracts/documents.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { kore } from "../src/kore/sdk/index.ts";
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

test("SDK item authoring composes effects and serializes economy configuration", () => {
	const effects = kore.composeItemEffects(
		{ type: "modifyForce", value: { factor: 0.5 } },
		{ type: "freeze", value: { speedFactor: 0.25, durationTurns: 2 } },
	);
	const item = kore.createItem({
		id: "sdk-item",
		name: "SDK Item",
		type: "utility",
		effects,
		targetType: "self",
		duration: { type: "turns", value: 2 },
		useLimit: { perTurn: 1, perGame: 2 },
		targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false },
	});
	const map = kore.createDefaultMap({ id: "33333333-3333-4333-8333-333333333333", name: "Item SDK" })
		.addPlayerSpawn({ x: 40, y: 130, w: 180, h: 180, teamNr: 0, playerCount: 1 })
		.addPlayerSpawn({ x: 580, y: 130, w: 180, h: 180, teamNr: 1, playerCount: 1 })
		.addItem(item)
		.addFixedLoadout({ team: 0, items: [{ itemId: "sdk-item", uses: 2 }] })
		.addItemPickup({ itemId: "sdk-item", spawnRegion: { x: 300, y: 200, w: 40, h: 40 }, activationType: "collision" })
		.setSeededItemDraw({ seed: 42, itemIds: ["sdk-item"], drawsPerTurn: 1 })
		.setMysteryBox({ candidatePool: ["sdk-item"] });
	const settings = map.build();

	expect(settings.items).toEqual([item]);
	expect(settings.gameMode?.itemEconomy).toEqual({
		fixedLoadouts: [{ team: 0, items: [{ itemId: "sdk-item", uses: 2 }] }],
		mapPickups: [{ itemId: "sdk-item", spawnRegion: { x: 300, y: 200, w: 40, h: 40 }, activationType: "collision" }],
		randomDraw: { seed: 42, itemIds: ["sdk-item"], drawsPerTurn: 1 },
		mysteryBox: { candidatePool: ["sdk-item"] },
	});
	expect(JSON.parse(map.buildJson())).toEqual(settings);
	expect(() => kore.createItem({ id: "bad", name: "Bad", type: "utility", effects: [{ type: "constructor" }] })).toThrow("Unsupported KORE item effect");
	expect(() => kore.createDefaultMap()
		.addPlayerSpawn({ x: 40, y: 130, w: 180, h: 180, teamNr: 0, playerCount: 1 })
		.addPlayerSpawn({ x: 580, y: 130, w: 180, h: 180, teamNr: 1, playerCount: 1 })
		.addFixedLoadout({ team: 0, items: [{ itemId: "missing", uses: 1 }] })
		.build()).toThrow("unknown item");
});
