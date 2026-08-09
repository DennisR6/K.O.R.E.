import { describe, expect, test } from "bun:test";
import {
	mysteryBoxItem,
	resolveMysteryBoxReward,
	generateRandomMapPickupPosition,
	createOfficialItemLoader,
} from "../src/item/officialItems.js";
import { MapPickupSystem } from "../src/item/MapPickupSystem.js";
import { kore } from "../src/kore/sdk/index.js";
import { createRuntimePlayer } from "../src/entity/runtimeFactory.js";
import type { ItemPickup } from "../src/item/types.js";

describe("Mystery Box / Random Item Spawns", () => {
	test("mysteryBoxItem registers cleanly in official item loader", () => {
		const loader = createOfficialItemLoader();
		const registered = loader.get("mystery-box");

		expect(registered).toBeDefined();
		expect(registered?.name).toBe("Wunderkiste");
		expect(registered?.type).toBe("utility");
		expect(registered?.ui).toEqual({ component: { type: "image", source: "public/items/mystery_box.svg" }, showLabel: true });
	});

	test("generateRandomMapPickupPosition produces valid bounds within world size", () => {
		const worldSize = { x: 800, y: 450 };
		const bounds = generateRandomMapPickupPosition(worldSize, 50, 12345);

		expect(bounds.x).toBeGreaterThanOrEqual(50);
		expect(bounds.x + bounds.w).toBeLessThanOrEqual(worldSize.x - 50);
		expect(bounds.y).toBeGreaterThanOrEqual(50);
		expect(bounds.y + bounds.h).toBeLessThanOrEqual(worldSize.y - 50);
		expect(bounds.w).toBe(40);
		expect(bounds.h).toBe(40);
	});

	test("resolveMysteryBoxReward returns specific item when specificItemId is requested", () => {
		const reward = resolveMysteryBoxReward({ specificItemId: "power-dash" });
		expect(reward).toBe("power-dash");
	});

	test("resolveMysteryBoxReward returns deterministic random item from candidate pool using seed", () => {
		const pool = ["anker", "durchlaessigkeit", "power-dash", "magnet"];
		const reward1 = resolveMysteryBoxReward({ candidatePool: pool, seed: 10 });
		const reward2 = resolveMysteryBoxReward({ candidatePool: pool, seed: 10 });

		expect(reward1).toBe(reward2);
		expect(pool.includes(reward1)).toBe(true);
	});

	test("collecting random mystery box pickup grants item to player inventory via MapPickupSystem", () => {
		const loader = createOfficialItemLoader();
		const player = createRuntimePlayer(
			kore.createPlayer({
				id: "hero-1",
				teamNr: 0,
				position: { x: 100, y: 100 },
				radius: 20,
			})
		);

		const rewardItemId = resolveMysteryBoxReward({ candidatePool: ["anker", "power-dash"], seed: 42 });
		const rewardItemDoc = loader.get(rewardItemId)!;

		const pickup: ItemPickup = {
			id: "mystery-pickup-1",
			itemId: rewardItemId,
			spawnRegion: { x: 90, y: 90, w: 40, h: 40 },
			maxPickupsPerTurn: 1,
		};

		const system = new MapPickupSystem();
		system.configure([pickup], [rewardItemDoc]);

		const mockCtx: any = {
			entities: { getEntities: () => [player] },
			activeTeam: 0,
			currTurn: 0,
		};

		system.ticker(mockCtx, 0, 0);

		const inventory = player.getInventory();
		expect(inventory.length).toBe(1);
		expect(inventory[0]?.itemId).toBe(rewardItemId);
	});
});
