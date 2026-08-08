import { describe, expect, test } from "bun:test";
import { kore, createPlayer, type KorePlayerInput } from "../src/kore/sdk/index.js";
import { createRuntimePlayer } from "../src/entity/runtimeFactory.js";
import { Player } from "../src/entity/Player.js";
import { createPlayerSettings } from "../src/entity/types.js";
import { AssetList } from "../src/assetManager/assets/assetRegistry.js";
import { SHAPE } from "../src/physics/physics.js";

describe("Player SDK Authoring & Migration Parity", () => {

	describe("SDK Authoring Tests", () => {
		test("default player construction produces canonical JSON-safe settings", () => {
			const settings = kore.createPlayer();
			expect(settings.id).toBeDefined();
			expect(settings.hp).toBe(30);
			expect(settings.mass).toBe(1);
			expect(settings.size).toBe(20);
			expect(settings.shape).toBe(SHAPE.CIRCLE);
			expect(settings.isPhysicsEnabled).toBe(true);
			expect(settings.isDrawingEnabled).toBe(true);

			const jsonString = JSON.stringify(settings);
			expect(JSON.parse(jsonString)).toEqual(settings);
		});

		test("explicit construction preserves custom values", () => {
			const input: KorePlayerInput = {
				id: "player-blue-1",
				teamNr: 0,
				position: { x: 120, y: 180 },
				velocity: { x: 5, y: -10 },
				radius: 25,
				hp: 100,
				mass: 2,
				color: "blue",
			};
			const settings = kore.createPlayer(input);

			expect(settings.id).toBe("player-blue-1");
			expect(settings.team).toEqual([0]);
			expect(settings.position).toEqual({ x: 120, y: 180 });
			expect(settings.velocity).toEqual({ x: 5, y: -10 });
			expect(settings.size).toBe(25);
			expect(settings.hp).toBe(100);
			expect(settings.mass).toBe(2);
			expect(settings.color).toBe("blue");
		});

		test("input detachment prevents post-creation mutation side effects", () => {
			const pos = { x: 50, y: 50 };
			const vel = { x: 10, y: 0 };
			const settings = kore.createPlayer({ position: pos, velocity: vel });

			pos.x = 999;
			vel.x = 999;

			expect(settings.position.x).toBe(50);
			expect(settings.velocity.x).toBe(10);
		});

		test("validation rejects invalid IDs", () => {
			expect(() => kore.createPlayer({ id: "" })).toThrow("Player ID must be a non-empty string");
			expect(() => kore.createPlayer({ id: "   " })).toThrow("Player ID must be a non-empty string");
		});

		test("validation rejects invalid teamNr", () => {
			expect(() => kore.createPlayer({ teamNr: -1 })).toThrow("Player teamNr must be a non-negative integer");
			expect(() => kore.createPlayer({ teamNr: 1.5 })).toThrow("Player teamNr must be a non-negative integer");
		});

		test("validation rejects non-finite position coordinates", () => {
			expect(() => kore.createPlayer({ position: { x: NaN, y: 10 } })).toThrow("Player position must contain finite numbers");
			expect(() => kore.createPlayer({ position: { x: 10, y: Infinity } })).toThrow("Player position must contain finite numbers");
		});

		test("validation rejects non-finite velocity components", () => {
			expect(() => kore.createPlayer({ velocity: { x: NaN, y: 0 } })).toThrow("Player velocity must contain finite numbers");
		});

		test("validation rejects non-positive or non-finite radius/size", () => {
			expect(() => kore.createPlayer({ radius: 0 })).toThrow("Player radius must be a finite positive number");
			expect(() => kore.createPlayer({ radius: -5 })).toThrow("Player radius must be a finite positive number");
		});

		test("validation rejects non-positive or non-finite mass", () => {
			expect(() => kore.createPlayer({ mass: 0 })).toThrow("Player mass must be a finite positive number");
			expect(() => kore.createPlayer({ mass: -1 })).toThrow("Player mass must be a finite positive number");
		});
	});

	describe("Runtime Player Factory Tests", () => {
		test("createRuntimePlayer constructs a valid Player instance from PlayerSettings", () => {
			const settings = kore.createPlayer({ id: "test-runtime-1", teamNr: 1, position: { x: 100, y: 200 } });
			const runtimePlayer = createRuntimePlayer(settings);

			expect(runtimePlayer).toBeInstanceOf(Player);
			expect(runtimePlayer.getId()).toBe("test-runtime-1");
			expect(runtimePlayer.getPos()).toEqual({ x: 100, y: 200 });
		});

		test("runtime toSettings() round-trips cleanly to canonical settings", () => {
			const originalSettings = kore.createPlayer({
				id: "rt-roundtrip",
				teamNr: 0,
				position: { x: 10, y: 20 },
				velocity: { x: 1, y: 2 },
				hp: 25,
				mass: 1,
				radius: 18,
				color: "red",
			});

			const runtimePlayer = createRuntimePlayer(originalSettings);
			const serializedSettings = runtimePlayer.toSettings();

			expect(serializedSettings).toEqual(originalSettings);
		});

		test("dead-state and inventory reconstruction works through runtime factory", () => {
			const settings = kore.createPlayer({
				id: "dead-player",
				isPhysicsEnabled: false,
				isDrawingEnabled: false,
				hp: 0,
				inventory: [{ id: "item-1", name: "Shield", usesRemaining: 1 }],
			});

			const runtimePlayer = createRuntimePlayer(settings);
			expect(runtimePlayer.isDead()).toBe(true);
			expect(runtimePlayer.getInventory()).toEqual([{ id: "item-1", name: "Shield", usesRemaining: 1 }]);

			const roundtripSettings = runtimePlayer.toSettings();
			expect(roundtripSettings.isPhysicsEnabled).toBe(false);
			expect(roundtripSettings.isDrawingEnabled).toBe(false);
			expect(roundtripSettings.inventory).toEqual([{ id: "item-1", name: "Shield", usesRemaining: 1 }]);
		});
	});

	describe("Parity with Legacy Construction", () => {
		test("legacy createPlayerSettings vs kore.createPlayer produce identical structure", () => {
			const id = "parity-check-1" as const;
			const legacy = createPlayerSettings({ id, team: [0], position: { x: 50, y: 50 } });
			const sdk = kore.createPlayer({ id, teamNr: 0, position: { x: 50, y: 50 } });

			expect(sdk).toEqual(legacy);
		});

		test("legacy new Player(settings) vs createRuntimePlayer(settings) behavior parity", () => {
			const settings = kore.createPlayer({ id: "parity-rt-1", teamNr: 1, position: { x: 30, y: 40 } });
			const legacyRuntime = new Player(settings);
			const factoryRuntime = createRuntimePlayer(settings);

			expect(factoryRuntime.toSettings()).toEqual(legacyRuntime.toSettings());
		});
	});
});
