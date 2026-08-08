import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { DELAYED_MINE_DELAY_TICKS, verzoegerteMineItem } from "../src/item/officialItems.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { ReplayRecorder } from "../src/replay/recorder.ts";
import { RulePhase, WinCondition } from "../src/rules/types.ts";

function mineHandler() {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = [verzoegerteMineItem];
	settings.players[0]!.position = { x: 100, y: 100 };
	settings.players[1]!.position = { x: 130, y: 100 };
	settings.players[1]!.velocity = { x: 0, y: 0 };
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const target = handler.getEntityManager().getEntities()[1]!;
	actor.setInventory([{ itemId: verzoegerteMineItem.id, remainingUses: 1, usesThisTurn: 0 }]);
	return { handler, actor, target };
}

test("Delayed Mine binds a position and stores a fixed-tick one-shot record", () => {
	const { handler, actor } = mineHandler();
	handler.useItem(actor.getId(), verzoegerteMineItem.id, { type: "position", position: { x: 100, y: 100 } });

	expect(actor.getInventory()).toEqual([{ itemId: verzoegerteMineItem.id, remainingUses: 0, usesThisTurn: 1 }]);
	expect(handler.toSettings().deferredEffects).toMatchObject([{ durationUnit: "ticks", duration: DELAYED_MINE_DELAY_TICKS, remaining: DELAYED_MINE_DELAY_TICKS, ownerId: actor.getId(), effect: { type: "movement.apply-force-field", target: { type: "position", position: { x: 100, y: 100 } } } }]);
});

test("Delayed Mine executes at the third tick and removes its record", () => {
	const { handler, actor, target } = mineHandler();
	handler.useItem(actor.getId(), verzoegerteMineItem.id, { type: "position", position: { x: 100, y: 100 } });

	handler.tick(1);
	handler.tick(1);
	expect(target.getVel()).toEqual({ x: 0, y: 0 });
	handler.tick(1);
	expect(target.getVel().x).toBeLessThan(0);
	expect(handler.toSettings().deferredEffects).toBeUndefined();
	const after = target.getVel().x;
	handler.tick(1);
	expect(target.getVel().x).toBeGreaterThan(after - 0.02);
});

test("Delayed Mine uses the original position even when entities move before due time", () => {
	const { handler, actor, target } = mineHandler();
	handler.useItem(actor.getId(), verzoegerteMineItem.id, { type: "position", position: { x: 100, y: 100 } });
	target.setPos({ x: 130, y: 100 });
	target.setVel({ x: 0, y: 0 });
	for (let tick = 0; tick < DELAYED_MINE_DELAY_TICKS; tick++) handler.tick(1);
	expect(target.getVel().x).toBeLessThan(0);
});

test("Delayed Mine consumes its record when no active entity can be affected", () => {
	const { handler, actor, target } = mineHandler();
	handler.useItem(actor.getId(), verzoegerteMineItem.id, { type: "position", position: { x: 100, y: 100 } });
	target.setIsDead(true);
	for (let tick = 0; tick < DELAYED_MINE_DELAY_TICKS; tick++) handler.tick(1);
	expect(handler.toSettings().deferredEffects).toBeUndefined();
});

test("Delayed Mine snapshot restoration preserves the remaining tick boundary", () => {
	const { handler, actor } = mineHandler();
	handler.useItem(actor.getId(), verzoegerteMineItem.id, { type: "position", position: { x: 100, y: 100 } });
	handler.tick(1);
	const snapshot = JSON.parse(JSON.stringify(handler.toSettings()));
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();
	const restoredTarget = restored.getEntityManager().getEntities()[1]!;
	expect(restored.toSettings()).toEqual(snapshot);
	restored.tick(1);
	expect(restoredTarget.getVel()).toEqual({ x: 0, y: 0 });
	restored.tick(1);
	expect(restoredTarget.getVel().x).toBeLessThan(0);
	expect(restored.toSettings().deferredEffects).toBeUndefined();
});

test("Delayed Mine replay recreates the canonical deferred record", () => {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = [verzoegerteMineItem];
	settings.gameMode = { id: "deferred-mine-replay", phases: [RulePhase.Item, RulePhase.Physics], maxItemsPerTurn: 1, winCondition: WinCondition.LastTeamStanding, itemEconomy: { fixedLoadouts: [{ team: 0, items: [{ itemId: verzoegerteMineItem.id, uses: 1 }] }], mapPickups: [] } };
	const actor = settings.players[0]!;
	const recorder = new ReplayRecorder(settings);
	recorder.recordItemUse(actor.id, verzoegerteMineItem.id, { type: "position", position: actor.position });
	const replay = new ReplayPlayer(recorder.getReplay());
	replay.playAll();
	expect(replay.getHandler().toSettings().deferredEffects).toHaveLength(1);
});

test("Multiple due Mines retain deterministic accepted-use order", () => {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = [verzoegerteMineItem];
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const [first, second] = handler.getEntityManager().getEntities();
	first!.setInventory([{ itemId: verzoegerteMineItem.id, remainingUses: 1, usesThisTurn: 0 }]);
	second!.setInventory([{ itemId: verzoegerteMineItem.id, remainingUses: 1, usesThisTurn: 0 }]);
	handler.useItem(first!.getId(), verzoegerteMineItem.id, { type: "position", position: first!.getPos() });
	handler.useItem(second!.getId(), verzoegerteMineItem.id, { type: "position", position: second!.getPos() });

	expect(handler.toSettings().deferredEffects?.map(effect => effect.id)).toEqual([
		`${first!.getId()}:${verzoegerteMineItem.id}:0`,
		`${second!.getId()}:${verzoegerteMineItem.id}:0`,
	]);
});
