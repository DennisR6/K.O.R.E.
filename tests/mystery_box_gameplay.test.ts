import { describe, expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.js";
import { GameEmitter } from "../src/emitter/EngineEmitter.js";
import { createRuntimePlayer } from "../src/entity/runtimeFactory.js";
import { kore } from "../src/kore/sdk/index.js";
import { MapPickupSystem } from "../src/item/MapPickupSystem.js";
import {
	createOfficialItemLoader,
	DEFAULT_MYSTERY_BOX_POOL,
	deriveMysteryBoxSeed,
	generateRandomMapPickupPosition,
	grantMysteryBoxReward,
	hashString,
	MYSTERY_BOX_ITEM_ID,
	mysteryBoxItem,
	resolveMysteryBoxReward,
} from "../src/item/officialItems.js";
import type { InventoryItem, ItemDocument } from "../src/item/types.js";
import { RuleInterpreter } from "../src/rules/RuleInterpreter.js";
import { RulePhase, validateItemEconomySettings, WinCondition } from "../src/rules/types.js";
import { createDefaultGameSettings, validateGameSettings } from "../src/settings/settings.js";
import { ItemPhaseUI } from "../src/ui/ItemPhaseUI.js";

const GAME_ID = "8a67d1b0-5c76-4348-bc7a-012d8c9746cc";

function officialItems(): ItemDocument[] {
	return createOfficialItemLoader().getAll();
}

function createMysteryBoxSettings(options: {
	pool?: string[];
	allowMysteryBoxReward?: boolean;
	boxUses?: number;
	loadoutItems?: { itemId: string; uses: number }[];
	randomDrawSeed?: number;
	declaredItems?: ItemDocument[];
} = {}) {
	const declaredItems = options.declaredItems ?? officialItems();
	const settings = {
		...createDefaultGameSettings(2, 1),
		items: declaredItems,
		gameMode: {
			id: "mystery-box-mode",
			phases: [RulePhase.Item, RulePhase.Physics],
			maxItemsPerTurn: 1,
			winCondition: WinCondition.LastTeamStanding,
			itemEconomy: {
				fixedLoadouts: [{ team: 0, items: options.loadoutItems ?? [{ itemId: MYSTERY_BOX_ITEM_ID, uses: options.boxUses ?? 3 }] }],
				mapPickups: [],
				...(options.randomDrawSeed !== undefined ? { randomDraw: { seed: options.randomDrawSeed, itemIds: [MYSTERY_BOX_ITEM_ID], drawsPerTurn: 1 } } : {}),
				mysteryBox: {
					candidatePool: options.pool ?? [...DEFAULT_MYSTERY_BOX_POOL],
					...(options.allowMysteryBoxReward !== undefined ? { allowMysteryBoxReward: options.allowMysteryBoxReward } : {}),
				},
			},
		},
	};
	// Stable player identities so reward seeds are reproducible across identical setups.
	settings.players[0]!.id = "hero-1";
	settings.players[1]!.id = "enemy-1";
	return settings;
}

function buildPipeline(settings: ReturnType<typeof createMysteryBoxSettings>) {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, settings.gameMode, 2);
	expect(handler.getRuleState().phase).toBe(RulePhase.Item);
	return { handler, actor, emitter };
}

function inventoryOf(actor: { getInventory(): InventoryItem[] }): InventoryItem[] {
	return actor.getInventory();
}

function boxEntry(inventory: InventoryItem[]): InventoryItem {
	return inventory.find(entry => entry.itemId === MYSTERY_BOX_ITEM_ID)!;
}

describe("Mystery Box gameplay", () => {
	test("creates a player that owns a mystery-box item", () => {
		const player = createRuntimePlayer(
			kore.createPlayer({
				id: "hero-1",
				teamNr: 0,
				position: { x: 100, y: 100 },
				radius: 20,
				inventory: [{ itemId: MYSTERY_BOX_ITEM_ID, remainingUses: 2, usesThisTurn: 0 }],
			})
		);
		expect(inventoryOf(player)).toEqual([{ itemId: MYSTERY_BOX_ITEM_ID, remainingUses: 2, usesThisTurn: 0 }]);
		expect(player.getId()).toBe("hero-1");
	});

	test("a fixed loadout can enter the correct item phase", () => {
		const settings = createMysteryBoxSettings();
		const { handler, actor } = buildPipeline(settings);
		expect(handler.getRuleState()).toEqual({ phase: RulePhase.Item, activeTeam: 0, turnNumber: 0, itemUses: 0 });
		expect(boxEntry(inventoryOf(actor))!.remainingUses).toBe(3);
		const interpreter = new RuleInterpreter(settings.gameMode);
		expect(interpreter.useItem(handler.getRuleState()).itemUses).toBe(1);
	});

	test("uses the mystery box through the normal emitter/action pipeline", () => {
		const settings = createMysteryBoxSettings({ pool: ["anker"] });
		const { handler, actor, emitter } = buildPipeline(settings);
		const itemUi = new ItemPhaseUI(handler, emitter);
		expect(itemUi.getPhaseState().canUseItems).toBe(true);

		itemUi.use(actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" });

		expect(handler.getRuleState()).toEqual({ phase: RulePhase.Item, activeTeam: 0, turnNumber: 0, itemUses: 1 });
		expect(emitter.recorder.getReplay().actions).toEqual([{ type: "itemUse", actorId: actor.getId(), itemId: MYSTERY_BOX_ITEM_ID, target: { type: "self" } }]);
	});

	test("validates command and target through gameplay authority", () => {
		const settings = createMysteryBoxSettings({ pool: ["anker"] });
		const { handler, actor } = buildPipeline(settings);
		const before = inventoryOf(actor);

		// The mystery box requires a self target; an authority-level misuse is rejected.
		expect(() => handler.useItem(actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "position", position: { x: 100, y: 100 } }))
			.toThrow("Item requires a self target");
		// Unknown item IDs are rejected by the same boundary.
		expect(() => handler.useItem(actor.getId(), "not-an-item", { type: "self" })).toThrow("Item 'not-an-item' is not declared for this game");
		// A dead actor cannot use items.
		const dead = createRuntimePlayer(kore.createPlayer({ id: "dead-1", teamNr: 0, position: { x: 50, y: 50 }, radius: 20 }));
		dead.setIsDead(true);
		handler.getEntityManager().addEntity(dead);
		expect(() => handler.useItem(dead.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" })).toThrow();
		// Rejected uses never mutate the inventory.
		expect(inventoryOf(actor)).toEqual(before);
	});

	test("resolves the reward deterministically", () => {
		const seed = deriveMysteryBoxSeed({ actorId: "hero-1", turnNumber: 0, activeTeam: 0, baseSeed: hashString(GAME_ID) });
		expect(resolveMysteryBoxReward({ candidatePool: ["anker", "power-dash"], seed }))
			.toBe(resolveMysteryBoxReward({ candidatePool: ["anker", "power-dash"], seed }));

		const first = buildPipeline(createMysteryBoxSettings({ pool: ["anker", "power-dash"] }));
		const second = buildPipeline(createMysteryBoxSettings({ pool: ["anker", "power-dash"] }));
		first.emitter.sendItemUse(first.actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" });
		second.emitter.sendItemUse(second.actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" });

		const firstReward = inventoryOf(first.actor).find(entry => entry.itemId !== MYSTERY_BOX_ITEM_ID)!.itemId;
		const secondReward = inventoryOf(second.actor).find(entry => entry.itemId !== MYSTERY_BOX_ITEM_ID)!.itemId;
		expect(firstReward).toBe(secondReward);
	});

	test("candidate-pool declaration order is the deterministic selection order", () => {
		const pool = ["first", "second", "third"];
		expect(resolveMysteryBoxReward({ candidatePool: pool, seed: 0 })).toBe("first");
		expect(resolveMysteryBoxReward({ candidatePool: pool, seed: 1 })).toBe("second");
		expect(resolveMysteryBoxReward({ candidatePool: pool, seed: 2 })).toBe("third");
		expect(resolveMysteryBoxReward({ candidatePool: ["first", "first"], seed: 1 })).toBe("first");
	});

	test("removes exactly one mystery box from inventory", () => {
		const { actor, emitter } = buildPipeline(createMysteryBoxSettings({ pool: ["anker"] }));
		emitter.sendItemUse(actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" });

		const box = boxEntry(inventoryOf(actor));
		expect(box!.remainingUses).toBe(2);
		expect(box!.usesThisTurn).toBe(1);
	});

	test("adds exactly one valid reward item", () => {
		const settings = createMysteryBoxSettings({ pool: ["anker"] });
		const { actor, emitter } = buildPipeline(settings);
		const before = inventoryOf(actor);
		emitter.sendItemUse(actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" });
		const after = inventoryOf(actor);

		const reward = after.find(entry => entry.itemId === "anker")!;
		expect(reward).toBeDefined();
		expect(reward!.remainingUses).toBe(1);
		expect(after.filter(entry => entry.itemId === "anker").length).toBe(1);
		// Exactly one use is granted: the only inventory change besides the consumed box.
		const rewardBefore = before.find(entry => entry.itemId === "anker");
		expect(reward!.remainingUses - (rewardBefore?.remainingUses ?? 0)).toBe(1);
		expect(createOfficialItemLoader().get(reward!.itemId)).toBeDefined();
		expect(settings.items.some(item => item.id === reward!.itemId)).toBe(true);
	});

	test("reward belongs to the configured candidate pool", () => {
		const pool = ["falltuer", "vodka-zero"];
		const { actor, emitter } = buildPipeline(createMysteryBoxSettings({ pool }));
		emitter.sendItemUse(actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" });

		const rewardId = inventoryOf(actor).find(entry => entry.itemId !== MYSTERY_BOX_ITEM_ID)!.itemId;
		expect(pool).toContain(rewardId);
		expect(DEFAULT_MYSTERY_BOX_POOL).not.toContain(rewardId);

		// The exact reward is the deterministic seed projection into the pool.
		const baseSeed = hashString(GAME_ID);
		const seed = deriveMysteryBoxSeed({ actorId: actor.getId(), turnNumber: 0, activeTeam: 0, baseSeed });
		expect(rewardId).toBe(pool[Math.abs(seed) % pool.length]);
	});

	test("snapshots the game after resolution", () => {
		const { handler, actor, emitter } = buildPipeline(createMysteryBoxSettings({ pool: ["anker"] }));
		emitter.sendItemUse(actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" });

		const snapshot = handler.toSettings();
		const snapshotActor = snapshot.players.find(player => player.id === actor.getId())!;
		expect(snapshotActor.inventory).toEqual(inventoryOf(actor));
		expect(snapshotActor.inventory.some(entry => entry.itemId === "anker")).toBe(true);
		expect(snapshot.ruleState).toEqual({ phase: RulePhase.Item, activeTeam: 0, turnNumber: 0, itemUses: 1 });
	});

	test("restores the snapshot with identical inventory state", () => {
		const { handler, actor, emitter } = buildPipeline(createMysteryBoxSettings({ pool: ["anker"] }));
		emitter.sendItemUse(actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" });
		const snapshot = handler.toSettings();

		const restored = new GameHandlerBuilder().defaultSystems().fromSettings(JSON.parse(JSON.stringify(snapshot))).build();
		const restoredActor = restored.getEntityManager().getEntityById(actor.getId())!;
		expect(restoredActor.getInventory()).toEqual(inventoryOf(actor));
		expect(restored.getRuleState()).toEqual(handler.getRuleState());
	});

	test("replays the action with the same reward", () => {
		const settings = createMysteryBoxSettings({ pool: ["anker", "power-dash", "magnet"] });
		const first = buildPipeline(settings);
		// Snapshot before resolution, then resolve on the original match.
		const beforeSnapshot = first.handler.toSettings();
		first.emitter.sendItemUse(first.actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" });
		const firstReward = inventoryOf(first.actor).find(entry => entry.itemId !== MYSTERY_BOX_ITEM_ID)!.itemId;

		// Replay the recorded action against a restored snapshot of the same match.
		const action = first.emitter.recorder.getReplay().actions[0]!;
		expect(action.type).toBe("itemUse");
		const second = buildPipeline(JSON.parse(JSON.stringify(beforeSnapshot)) as ReturnType<typeof createMysteryBoxSettings>);
		const replayEmitter = new GameEmitter(second.handler, settings.gameMode, 2);
		replayEmitter.sendItemUse(second.actor.getId(), (action as { itemId: string }).itemId, { type: "self" });

		const secondReward = inventoryOf(second.actor).find(entry => entry.itemId !== MYSTERY_BOX_ITEM_ID)!.itemId;
		expect(secondReward).toBe(firstReward);
		expect(second.handler.toSettings().players.find(player => player.id === second.actor.getId())!.inventory)
			.toEqual(inventoryOf(second.actor));
	});

	test("rejects an empty candidate pool", () => {
		expect(() => resolveMysteryBoxReward({ candidatePool: [], seed: 5 })).toThrow("Mystery Box pool must not be empty");
		expect(() => validateItemEconomySettings({ fixedLoadouts: [], mapPickups: [], mysteryBox: { candidatePool: [] } }))
			.toThrow("Mystery box rewards require a non-empty candidate pool");
		expect(() => buildPipeline(createMysteryBoxSettings({ pool: [] }))).toThrow("Mystery box rewards require a non-empty candidate pool");
	});

	test("rejects unknown item IDs", () => {
		const known = ["anker", "power-dash"];
		expect(() => resolveMysteryBoxReward({ specificItemId: "nope", knownItemIds: known })).toThrow("Mystery Box reward 'nope' is not a known item");
		expect(() => resolveMysteryBoxReward({ candidatePool: ["anker", "nope"], seed: 1, knownItemIds: known })).toThrow("Mystery Box reward 'nope' is not a known item");
		expect(() => grantMysteryBoxReward([], [{ ...mysteryBoxItem }] as ItemDocument[], { specificItemId: "nope" })).toThrow("is not a known item");

		// Config-time rejection mirrors the seeded-draw boundary.
		const settings = createMysteryBoxSettings({ pool: ["anker", "does-not-exist"] });
		expect(() => validateGameSettings(settings)).toThrow("Mystery Box pool references an unknown item");

		// Runtime authority rejection is atomic: the box is not consumed.
		const { actor, emitter, handler } = buildPipeline(settings);
		const before = inventoryOf(actor);
		expect(() => emitter.sendItemUse(actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" })).toThrow("is not a known item");
		expect(handler.getRuleState().itemUses).toBe(0);
		expect(inventoryOf(actor)).toEqual(before);
	});

	test("defines behavior for a full inventory", () => {
		// A reward already at its per-game cap never overflows the entry.
		const inventory: InventoryItem[] = [
			{ itemId: MYSTERY_BOX_ITEM_ID, remainingUses: 3, usesThisTurn: 0 },
			{ itemId: "anker", remainingUses: 2, usesThisTurn: 0 },
		];
		const granted = grantMysteryBoxReward(inventory, officialItems(), { specificItemId: "anker" });
		expect(granted).toBe("anker");
		expect(inventory).toEqual([
			{ itemId: MYSTERY_BOX_ITEM_ID, remainingUses: 3, usesThisTurn: 0 },
			{ itemId: "anker", remainingUses: 2, usesThisTurn: 0 },
		]);

		// Through the full pipeline the box is still consumed while the reward stays capped.
		const loadoutItems = [
			{ itemId: MYSTERY_BOX_ITEM_ID, uses: 3 },
			{ itemId: "anker", uses: 2 },
		];
		const { actor, emitter } = buildPipeline(createMysteryBoxSettings({ pool: ["anker"], loadoutItems }));
		emitter.sendItemUse(actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" });

		const after = inventoryOf(actor);
		expect(boxEntry(after)!.remainingUses).toBe(2);
		expect(after.find(entry => entry.itemId === "anker")).toEqual({ itemId: "anker", remainingUses: 2, usesThisTurn: 0 });
		expect(after.filter(entry => entry.itemId === "anker").length).toBe(1);
	});

	test("prevents recursive mystery-box rewards unless explicitly enabled", () => {
		// Default: resolution to another mystery box is rejected regardless of seed.
		expect(() => resolveMysteryBoxReward({ specificItemId: MYSTERY_BOX_ITEM_ID })).toThrow("unless explicitly enabled");

		// Order the pool by the actual match seed so the resolved index hits the box.
		const probe = buildPipeline(createMysteryBoxSettings({ pool: ["anker"] }));
		const baseSeed = hashString(GAME_ID);
		const seed = deriveMysteryBoxSeed({ actorId: probe.actor.getId(), turnNumber: 0, activeTeam: 0, baseSeed });
		const pool = Math.abs(seed) % 2 === 0 ? [MYSTERY_BOX_ITEM_ID, "anker"] : ["anker", MYSTERY_BOX_ITEM_ID];

		// Default: resolution to another mystery box is rejected.
		expect(() => resolveMysteryBoxReward({ candidatePool: pool, seed })).toThrow("unless explicitly enabled");
		// Explicitly enabled: the recursion is allowed.
		expect(resolveMysteryBoxReward({ candidatePool: pool, seed, allowMysteryBoxReward: true })).toBe(MYSTERY_BOX_ITEM_ID);

		// Pipeline: a recursive pool fails atomically by default.
		const blocked = buildPipeline(createMysteryBoxSettings({ pool }));
		const before = inventoryOf(blocked.actor);
		expect(() => blocked.emitter.sendItemUse(blocked.actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" })).toThrow("unless explicitly enabled");
		expect(blocked.handler.getRuleState().itemUses).toBe(0);
		expect(inventoryOf(blocked.actor)).toEqual(before);

		// Pipeline: enabled recursion grants another mystery box.
		const enabled = buildPipeline(createMysteryBoxSettings({ pool, allowMysteryBoxReward: true }));
		enabled.emitter.sendItemUse(enabled.actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" });
		const enabledAfter = inventoryOf(enabled.actor);
		expect(boxEntry(enabledAfter)!.remainingUses).toBe(3);
		expect(enabledAfter.filter(entry => entry.itemId === MYSTERY_BOX_ITEM_ID).length).toBe(1);
	});

	test("collecting a spawned mystery-box pickup grants the box, then the item phase resolves a reward", () => {
		const settings = createMysteryBoxSettings({ pool: ["anker"], boxUses: 1 });
		const { handler, actor } = buildPipeline(settings);

		const spawn = generateRandomMapPickupPosition({ x: 800, y: 450 }, 40, 42);
		handler.configureMapItemPickups([{ id: "mystery-pickup-1", itemId: MYSTERY_BOX_ITEM_ID, spawnRegion: spawn, activationType: "collision" }]);

		actor.setPos({ x: spawn.x + 20, y: spawn.y + 20 });
		handler.tick(0);
		expect(boxEntry(inventoryOf(actor))!.remainingUses).toBe(2);

		const emitter = new GameEmitter(handler, settings.gameMode, 2);
		emitter.sendItemUse(actor.getId(), MYSTERY_BOX_ITEM_ID, { type: "self" });
		expect(boxEntry(inventoryOf(actor))!.remainingUses).toBe(1);
		expect(inventoryOf(actor).find(entry => entry.itemId === "anker")).toEqual({ itemId: "anker", remainingUses: 1, usesThisTurn: 0 });
	});
});

describe("Mystery Box helpers", () => {
	test("grantMysteryBoxReward adds exactly one use of a valid reward", () => {
		const inventory: InventoryItem[] = [];
		const rewardId = grantMysteryBoxReward(inventory, officialItems(), { candidatePool: ["power-dash", "magnet"], seed: 7 });
		expect(DEFAULT_MYSTERY_BOX_POOL.concat(["power-dash", "magnet"])).toContain(rewardId);
		expect(inventory).toEqual([{ itemId: rewardId, remainingUses: 1, usesThisTurn: 0 }]);
	});

	test("grantMysteryBoxReward increments an existing entry by exactly one use", () => {
		const inventory: InventoryItem[] = [{ itemId: "freeze-shot", remainingUses: 1, usesThisTurn: 0 }];
		grantMysteryBoxReward(inventory, officialItems(), { specificItemId: "freeze-shot" });
		expect(inventory).toEqual([{ itemId: "freeze-shot", remainingUses: 2, usesThisTurn: 0 }]);
	});

	test("failed reward grant leaves inventory unchanged", () => {
		const inventory: InventoryItem[] = [{ itemId: MYSTERY_BOX_ITEM_ID, remainingUses: 2, usesThisTurn: 1 }];
		const before = structuredClone(inventory);
		expect(() => grantMysteryBoxReward(inventory, officialItems(), { specificItemId: "not-declared" })).toThrow("is not a known item");
		expect(inventory).toEqual(before);
	});

	test("deriveMysteryBoxSeed is deterministic and varies by actor and turn", () => {
		const baseSeed = 12345;
		const first = deriveMysteryBoxSeed({ actorId: "a", turnNumber: 0, activeTeam: 0, baseSeed });
		expect(deriveMysteryBoxSeed({ actorId: "a", turnNumber: 0, activeTeam: 0, baseSeed })).toBe(first);
		expect(deriveMysteryBoxSeed({ actorId: "b", turnNumber: 0, activeTeam: 0, baseSeed })).not.toBe(first);
		expect(deriveMysteryBoxSeed({ actorId: "a", turnNumber: 1, activeTeam: 0, baseSeed })).not.toBe(first);
		expect(deriveMysteryBoxSeed({ actorId: "a", turnNumber: 0, activeTeam: 1, baseSeed })).not.toBe(first);
		expect(deriveMysteryBoxSeed({ actorId: "a", turnNumber: 0, activeTeam: 0, baseSeed: baseSeed + 1 })).not.toBe(first);
	});

	test("MapPickupSystem still collects pickups configured for any declared item", () => {
		const player = createRuntimePlayer(
			kore.createPlayer({ id: "hero-1", teamNr: 0, position: { x: 100, y: 100 }, radius: 20 })
		);
		const system = new MapPickupSystem();
		system.configure(
			[{ id: "pickup-1", itemId: "anker", spawnRegion: { x: 90, y: 90, w: 40, h: 40 }, activationType: "collision" }],
			officialItems()
		);
		system.ticker({ entities: { getEntities: () => [player] }, activeTeam: 0, currTurn: 0 } as any, 0, 0);
		expect(inventoryOf(player)).toEqual([{ itemId: "anker", remainingUses: 1, usesThisTurn: 0 }]);
	});
});
