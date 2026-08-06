import { describe, expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandler, GameHandlerBuilder } from "../src/engine/Handler.ts";
import { RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.ts";
import { createOfficialItemLoader, MYSTERY_BOX_ITEM_ID } from "../src/item/officialItems.ts";
import type { ItemDocument } from "../src/item/types.ts";
import type { ItemTarget } from "../src/item/target.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { WinningSystem } from "../src/systems/WinningSystem.ts";
import { ReplayPlayer } from "../src/replay/player.ts";

type Economy = "fixed-loadout" | "map-pickup" | "seeded-draw";

export interface ItemGameplayMetric {
	itemId: string;
	economy: Economy;
	availability: number;
	legalUses: number;
	actualUses: number;
	successfulEffects: number;
	winnerCorrelation: number | null;
	replayContinuity: boolean;
	snapshotContinuity: boolean;
	negativeSignals: string[];
}

const ITEM_IDS = createOfficialItemLoader().getAll().map(item => item.id);
const ECONOMIES: Economy[] = ["fixed-loadout", "map-pickup", "seeded-draw"];
const ACTOR_ID = "00000000-0000-4000-8000-000000000150";
const ALLY_ID = "00000000-0000-4000-8000-000000000151";
const ENEMY_ID = "00000000-0000-4000-8000-000000000152";

function mode(item: ItemDocument, economy: Economy): GameModeSettings {
	return {
		id: "item-qualification",
		phases: [RulePhase.Item, RulePhase.Physics],
		maxItemsPerTurn: 1,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: economy === "fixed-loadout"
			? { fixedLoadouts: [{ team: 0, items: [{ itemId: item.id, uses: 1 }] }], mapPickups: [] }
			: economy === "map-pickup"
				? { fixedLoadouts: [], mapPickups: [{ itemId: item.id, spawnRegion: { x: 150, y: 200, w: 100, h: 50 }, activationType: "proximity", maxPickupsPerTurn: 1 }] }
				: { fixedLoadouts: [], mapPickups: [], randomDraw: { seed: 1508, itemIds: [item.id], drawsPerTurn: 1 } },
	};
}

function targetFor(item: ItemDocument, valid: boolean): ItemTarget {
	if (item.targetType === "self") return valid ? { type: "self" } : { type: "entity", entityId: ENEMY_ID } as ItemTarget;
	if (item.targetType === "entity") {
		if (item.id === "switch") return valid ? { type: "entity", entityId: ALLY_ID } : { type: "entity", entityId: ENEMY_ID };
		return valid ? { type: "entity", entityId: ENEMY_ID } : { type: "self" } as ItemTarget;
	}
	return valid
		? { type: "position", position: { x: 200, y: 225 } }
		: { type: "position", position: { x: 1_000, y: 1_000 } };
}

function makeHandler(item: ItemDocument, economy: Economy): GameHandler {
	const settings = createDefaultGameSettings(2, 2);
	// The mystery box resolves its reward from the declared item registry, so
	// its qualification match must declare the whole official catalog.
	settings.items = item.id === MYSTERY_BOX_ITEM_ID ? createOfficialItemLoader().getAll() : [item];
	settings.players[0] = { ...settings.players[0]!, id: ACTOR_ID, team: [0], position: { x: 180, y: 225 } };
	settings.players[1] = { ...settings.players[1]!, id: ALLY_ID, team: [0], position: { x: 220, y: 225 } };
	settings.players[2] = { ...settings.players[2]!, id: ENEMY_ID, team: [1], position: { x: 380, y: 225 } };
	settings.players[3] = { ...settings.players[3]!, team: [1], position: { x: 420, y: 225 } };
	settings.gameMode = mode(item, economy);
	return new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new WinningSystem(2))
		.fromSettings(settings)
		.build();
}

function observablePlayer(handler: GameHandler): unknown {
	const player = handler.getEntityManager().getEntityById(ACTOR_ID);
	if (!player) throw new Error("qualification actor was not created");
	const snapshot = player.toSettings();
	return { position: snapshot.position, velocity: snapshot.velocity, hp: snapshot.hp, isDead: snapshot.isDead, effects: snapshot.effects };
}

function qualifyItem(item: ItemDocument, economy: Economy): ItemGameplayMetric {
	const handler = makeHandler(item, economy);
	handler.tick(); // Collect proximity pickups and initialize observable draw state.
	const emitter = new GameEmitter(handler, handler.toSettings().gameMode, 2, 1508);
	const before = handler.toSettings();
	const available = handler.getEntityManager().getEntityById(ACTOR_ID)?.getInventory().some(entry => entry.itemId === item.id && entry.remainingUses > 0) ?? false;
	const remainingBefore = handler.getEntityManager().getEntityById(ACTOR_ID)?.getInventory().find(entry => entry.itemId === item.id)?.remainingUses ?? 0;
	let rejectedUses = 0;
	try { handler.useItem(ACTOR_ID, item.id, targetFor(item, false)); } catch { rejectedUses++; }
	const legalUses = available ? 1 : 0;
	if (legalUses > 0) emitter.sendItemUse(ACTOR_ID, item.id, targetFor(item, true));
	let limitBypassed = false;
	try { emitter.sendItemUse(ACTOR_ID, item.id, targetFor(item, true)); limitBypassed = true; } catch { /* expected per-turn rejection */ }
	const afterUse = handler.toSettings();
	const remainingAfter = handler.getEntityManager().getEntityById(ACTOR_ID)?.getInventory().find(entry => entry.itemId === item.id)?.remainingUses ?? 0;
	const actualUses = remainingAfter < remainingBefore ? 1 : 0;
	const snapshot = handler.toSettings();
	const restored = new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(snapshot).build();
	const snapshotContinuity = JSON.stringify(restored.toSettings()) === JSON.stringify(snapshot);
	let replayContinuity = false;
	try {
		const replay = new ReplayPlayer(emitter.recorder.getReplay());
		replay.playAll();
		replayContinuity = JSON.stringify(replay.getHandler().toSettings()) === JSON.stringify(afterUse);
	} catch { replayContinuity = false; }
	const effectSucceeded = JSON.stringify(observablePlayer(handler)) !== JSON.stringify({
		position: before.players.find(player => player.id === ACTOR_ID)!.position,
		velocity: before.players.find(player => player.id === ACTOR_ID)!.velocity,
		hp: before.players.find(player => player.id === ACTOR_ID)!.hp,
		isDead: before.players.find(player => player.id === ACTOR_ID)!.isDead,
		effects: before.players.find(player => player.id === ACTOR_ID)!.effects,
	});
	const negativeSignals: string[] = [];
	if (!available) negativeSignals.push("item-never-available");
	if (legalUses === 0) negativeSignals.push("item-never-legally-used");
	if (legalUses > 0 && !effectSucceeded) negativeSignals.push("effect-disappears-after-use");
	if (legalUses > 0 && actualUses === 0) negativeSignals.push("use-was-not-consumed");
	if (limitBypassed) negativeSignals.push("per-turn-limit-bypassed");
	if (!replayContinuity) negativeSignals.push("replay-mismatch");
	if (!snapshotContinuity) negativeSignals.push("snapshot-mismatch");
	if (rejectedUses === 0) negativeSignals.push("invalid-target-was-accepted");
	negativeSignals.push("winner-correlation-unavailable-without-terminal-match");
	return {
		itemId: item.id,
		economy,
		availability: available ? 1 : 0,
		legalUses,
		actualUses,
		successfulEffects: effectSucceeded ? 1 : 0,
		winnerCorrelation: null,
		replayContinuity,
		snapshotContinuity,
		negativeSignals,
	};
}

export function qualifyItemGameplay(): ItemGameplayMetric[] {
	const loader = createOfficialItemLoader();
	return ITEM_IDS.flatMap(itemId => ECONOMIES.map(economy => qualifyItem(loader.get(itemId)!, economy)));
}

describe("Section 15.8 item gameplay qualification", () => {
	test("qualifies deterministic availability, use, economy, and continuity metrics", () => {
		const first = qualifyItemGameplay();
		const second = qualifyItemGameplay();
		expect(first).toEqual(second);
		expect(first).toHaveLength(36);
		expect(first.every(metric => metric.availability === 1)).toBe(true);
		expect(first.every(metric => metric.legalUses === 1 && metric.actualUses === 1)).toBe(true);
		expect(first.every(metric => metric.replayContinuity && metric.snapshotContinuity)).toBe(true);
		expect(first.every(metric => metric.winnerCorrelation === null)).toBe(true);
	});

	test("keeps negative signals visible instead of promoting incomplete item gameplay", () => {
		const metrics = qualifyItemGameplay();
		const signals = new Set(metrics.flatMap(metric => metric.negativeSignals));
		expect(signals).toContain("effect-disappears-after-use");
		expect(signals).toContain("winner-correlation-unavailable-without-terminal-match");
		expect(signals).not.toContain("item-never-available");
		expect(signals).not.toContain("item-never-legally-used");
		expect(signals).not.toContain("per-turn-limit-bypassed");
		expect(signals).not.toContain("replay-mismatch");
		expect(signals).not.toContain("snapshot-mismatch");
	});
});
