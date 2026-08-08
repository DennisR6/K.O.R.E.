import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { magnetItem, MAGNET_FORCE, MAGNET_RANGE } from "../src/item/officialItems.ts";
import { RulePhase, WinCondition } from "../src/rules/types.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { ReplayRecorder } from "../src/replay/recorder.ts";

const ACTOR_ID = "00000000-0000-4000-8000-000000000201" as const;
const TARGET_ID = "00000000-0000-4000-8000-000000000202" as const;
const UNRELATED_ID = "00000000-0000-4000-8000-000000000203" as const;

function magnetHandler() {
	const settings = createDefaultGameSettings(2, 2);
	settings.items = [magnetItem];
	settings.gameMode = { id: "magnet-characterization", phases: [RulePhase.Item, RulePhase.Physics], maxItemsPerTurn: 1, winCondition: WinCondition.LastTeamStanding, itemEconomy: { fixedLoadouts: [], mapPickups: [] } };
	settings.players[0] = { ...settings.players[0]!, id: ACTOR_ID, team: [0], position: { x: 100, y: 100 } };
	settings.players[1] = { ...settings.players[1]!, id: TARGET_ID, team: [1], position: { x: 110, y: 100 } };
	const unrelated = {
		...settings.players[2],
		id: UNRELATED_ID,
		team: [1],
		position: { x: 120, y: 100 },
	};
	settings.players = [settings.players[0]!, settings.players[1]!, unrelated];
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntityById(ACTOR_ID)!;
	actor.setInventory([{ itemId: magnetItem.id, remainingUses: 1, usesThisTurn: 0 }]);
	return { handler, actor, target: handler.getEntityManager().getEntityById(TARGET_ID)!, unrelated: handler.getEntityManager().getEntityById(UNRELATED_ID)! };
}

test("Magnet uses the selected entity only, even when another entity is also in range", () => {
	const { handler, actor, target, unrelated } = magnetHandler();
	target.setVel({ x: 1, y: 2 });
	unrelated.setVel({ x: 3, y: 4 });

	handler.useItem(actor.getId(), magnetItem.id, { type: "entity", entityId: target.getId() });

	expect(target.getVel()).toEqual({ x: 1 + MAGNET_FORCE, y: 2 });
	expect(unrelated.getVel()).toEqual({ x: 3, y: 4 });
	expect(actor.getInventory()).toEqual([{ itemId: magnetItem.id, remainingUses: 0, usesThisTurn: 1 }]);
});

test("Magnet uses the actor position as its immediate force origin", () => {
	const { handler, actor, target } = magnetHandler();
	actor.setPos({ x: 100, y: 100 });
	target.setPos({ x: 110, y: 110 });
	target.setVel({ x: 1, y: 2 });

	handler.useItem(actor.getId(), magnetItem.id, { type: "entity", entityId: target.getId() });

	const component = MAGNET_FORCE * 10 / Math.sqrt(200);
	expect(target.getVel().x).toBeCloseTo(1 + component);
	expect(target.getVel().y).toBeCloseTo(2 + component);
});

test("Magnet rejects targets outside its range and inactive targets before consuming inventory", () => {
	const { handler, actor, target } = magnetHandler();
	target.setPos({ x: actor.getPos().x + MAGNET_RANGE + 1, y: actor.getPos().y });
	expect(() => handler.useItem(actor.getId(), magnetItem.id, { type: "entity", entityId: target.getId() })).toThrow("outside the maximum range");
	expect(actor.getInventory()[0]).toEqual({ itemId: magnetItem.id, remainingUses: 1, usesThisTurn: 0 });

	target.setPos(actor.getPos());
	target.setIsDead(true);
	expect(() => handler.useItem(actor.getId(), magnetItem.id, { type: "entity", entityId: target.getId() })).toThrow("active entity");
	expect(actor.getInventory()[0]).toEqual({ itemId: magnetItem.id, remainingUses: 1, usesThisTurn: 0 });
});

test("Magnet has no velocity delta at zero distance and accepts the range boundary", () => {
	const { handler, actor, target } = magnetHandler();
	target.setPos(actor.getPos());
	target.setVel({ x: 1, y: 2 });
	handler.useItem(actor.getId(), magnetItem.id, { type: "entity", entityId: target.getId() });
	expect(target.getVel()).toEqual({ x: 1, y: 2 });

	const boundary = magnetHandler();
	boundary.target.setPos({ x: boundary.actor.getPos().x + MAGNET_RANGE, y: boundary.actor.getPos().y });
	expect(() => boundary.handler.useItem(boundary.actor.getId(), magnetItem.id, { type: "entity", entityId: boundary.target.getId() })).not.toThrow();
});

test("Magnet snapshot and replay preserve the immediate velocity result without runtime Magnet state", () => {
	const live = magnetHandler();
	live.handler.setRuleState({ phase: RulePhase.Item, activeTeam: 0, turnNumber: 0, itemUses: 0 });
	live.handler.useItem(live.actor.getId(), magnetItem.id, { type: "entity", entityId: live.target.getId() });
	const snapshot = live.handler.toSettings();
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();
	expect(restored.toSettings()).toEqual(snapshot);
	expect(snapshot.players.find(player => player.id === TARGET_ID)?.itemEffects).toBeUndefined();

	const replayOrigin = magnetHandler();
	replayOrigin.handler.setRuleState({ phase: RulePhase.Item, activeTeam: 0, turnNumber: 0, itemUses: 0 });
	const recorder = new ReplayRecorder(replayOrigin.handler.toSettings(), 123);
	recorder.recordItemUse(ACTOR_ID, magnetItem.id, { type: "entity", entityId: TARGET_ID });
	const replay = new ReplayPlayer(recorder.getReplay());
	replay.playAll();
	expect(replay.getHandler().getEntityManager().getEntityById(TARGET_ID)?.getVel()).toEqual(live.target.getVel());
});
