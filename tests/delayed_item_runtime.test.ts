import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { verzoegerteMineItem, DELAYED_MINE_DELAY_TICKS } from "../src/item/officialItems.ts";

function mineHandler() {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = [verzoegerteMineItem];
	settings.players[0]!.position = { x: 100, y: 100 };
	settings.players[1]!.position = { x: 130, y: 100 };
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const target = handler.getEntityManager().getEntities()[1]!;
	actor.setInventory([{ itemId: verzoegerteMineItem.id, remainingUses: 1, usesThisTurn: 0 }]);
	return { handler, actor, target };
}

test("Deferred Mine captures its position in canonical Engine state", () => {
	const { handler, actor } = mineHandler();
	handler.useItem(actor.getId(), verzoegerteMineItem.id, { type: "position", position: { x: 100, y: 100 } });
	const deferred = handler.toSettings().deferredEffects;
	expect(deferred).toHaveLength(1);
	expect(deferred?.[0]).toMatchObject({ durationUnit: "ticks", duration: DELAYED_MINE_DELAY_TICKS, remaining: DELAYED_MINE_DELAY_TICKS, ownerId: actor.getId(), effect: { type: "movement.apply-force-field", target: { type: "position", position: { x: 100, y: 100 } } } });
});

test("Deferred Mine executes once and removes its canonical record", () => {
	const { handler, actor, target } = mineHandler();
	handler.useItem(actor.getId(), verzoegerteMineItem.id, { type: "position", position: { x: 100, y: 100 } });
	for (let tick = 0; tick < DELAYED_MINE_DELAY_TICKS - 1; tick++) handler.tick(1);
	expect(target.getVel()).toEqual({ x: 0, y: 0 });
	handler.tick(1);
	expect(target.getVel().x).toBeLessThan(0);
	expect(handler.toSettings().deferredEffects).toBeUndefined();
	const after = target.getVel().x;
	handler.tick(1);
	expect(target.getVel().x).toBeGreaterThan(after - 0.02);
});

test("Deferred Mine snapshot restoration preserves the due boundary", () => {
	const { handler, actor } = mineHandler();
	handler.useItem(actor.getId(), verzoegerteMineItem.id, { type: "position", position: { x: 100, y: 100 } });
	handler.tick(1);
	const snapshot = JSON.parse(JSON.stringify(handler.toSettings()));
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();
	const target = restored.getEntityManager().getEntities()[1]!;
	expect(restored.toSettings()).toEqual(snapshot);
	restored.tick(1);
	expect(target.getVel()).toEqual({ x: 0, y: 0 });
	restored.tick(1);
	expect(target.getVel().x).toBeLessThan(0);
});

test("Deferred Mine consumes due records even when all affected entities are inactive", () => {
	const { handler, actor, target } = mineHandler();
	handler.useItem(actor.getId(), verzoegerteMineItem.id, { type: "position", position: { x: 100, y: 100 } });
	target.setIsDead(true);
	for (let tick = 0; tick < DELAYED_MINE_DELAY_TICKS; tick++) handler.tick(1);
	expect(handler.toSettings().deferredEffects).toBeUndefined();
});
