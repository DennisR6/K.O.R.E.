import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { switchItem } from "../src/item/officialItems.ts";
import { RulePhase, WinCondition } from "../src/rules/types.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { ReplayRecorder } from "../src/replay/recorder.ts";

const ACTOR_ID = "00000000-0000-4000-8000-000000000301" as const;
const ALLY_ID = "00000000-0000-4000-8000-000000000302" as const;
const ENEMY_ID = "00000000-0000-4000-8000-000000000303" as const;

function switchHandler() {
	const settings = createDefaultGameSettings(2, 2);
	settings.items = [switchItem];
	settings.gameMode = { id: "switch-characterization", phases: [RulePhase.Item, RulePhase.Physics], maxItemsPerTurn: 1, winCondition: WinCondition.LastTeamStanding, itemEconomy: { fixedLoadouts: [], mapPickups: [] } };
	settings.players[0] = { ...settings.players[0]!, id: ACTOR_ID, team: [0], position: { x: 100, y: 100 }, velocity: { x: 1, y: 2 }, rotation: 11 };
	settings.players[1] = { ...settings.players[1]!, id: ALLY_ID, team: [0], position: { x: 180, y: 140 }, velocity: { x: 3, y: 4 }, rotation: 22 };
	settings.players[2] = { ...settings.players[2]!, id: ENEMY_ID, team: [1], position: { x: 220, y: 180 } };
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntityById(ACTOR_ID)!;
	const ally = handler.getEntityManager().getEntityById(ALLY_ID)!;
	const enemy = handler.getEntityManager().getEntityById(ENEMY_ID)!;
	actor.setInventory([{ itemId: switchItem.id, remainingUses: 1, usesThisTurn: 0 }]);
	return { handler, actor, ally, enemy };
}

test("Switch captures both original positions before writing either entity", () => {
	const { handler, actor, ally, enemy } = switchHandler();
	const actorPosition = actor.getPos();
	const allyPosition = ally.getPos();
	const enemyPosition = enemy.getPos();

	handler.useItem(actor.getId(), switchItem.id, { type: "entity", entityId: ally.getId() });

	// Distinct positions make A = B; B = A fail if the second read observes A's write.
	expect(actor.getPos()).toEqual(allyPosition);
	expect(ally.getPos()).toEqual(actorPosition);
	expect(enemy.getPos()).toEqual(enemyPosition);
	expect(actor.getVel()).toEqual({ x: 1, y: 2 });
	expect(ally.getVel()).toEqual({ x: 3, y: 4 });
	expect(actor.toSettings().rotation).toBe(11);
	expect(ally.toSettings().rotation).toBe(22);
	expect(actor.getInventory()).toEqual([{ itemId: switchItem.id, remainingUses: 0, usesThisTurn: 1 }]);
});

test("Switch rejects self, enemy, out-of-range, and inactive targets without consuming inventory", () => {
	const { handler, actor, ally, enemy } = switchHandler();
	const original = actor.getPos();
	expect(() => handler.useItem(actor.getId(), switchItem.id, { type: "entity", entityId: actor.getId() })).toThrow("self targets");
	expect(() => handler.useItem(actor.getId(), switchItem.id, { type: "entity", entityId: enemy.getId() })).toThrow("enemy targets");
	ally.setPos({ x: actor.getPos().x + 301, y: actor.getPos().y });
	expect(() => handler.useItem(actor.getId(), switchItem.id, { type: "entity", entityId: ally.getId() })).toThrow("outside the maximum range");
	ally.setPos({ x: 180, y: 140 });
	ally.setIsDead(true);
	expect(() => handler.useItem(actor.getId(), switchItem.id, { type: "entity", entityId: ally.getId() })).toThrow("active entity");
	expect(actor.getPos()).toEqual(original);
	expect(actor.getInventory()).toEqual([{ itemId: switchItem.id, remainingUses: 1, usesThisTurn: 0 }]);
});

test("Switch snapshot and replay preserve only the exchanged positions", () => {
	const live = switchHandler();
	live.handler.setRuleState({ phase: RulePhase.Item, activeTeam: 0, turnNumber: 0, itemUses: 0 });
	live.handler.useItem(live.actor.getId(), switchItem.id, { type: "entity", entityId: live.ally.getId() });
	const snapshot = live.handler.toSettings();
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();
	expect(restored.toSettings()).toEqual(snapshot);
	expect(snapshot.players.find(player => player.id === ACTOR_ID)?.itemEffects).toBeUndefined();

	const origin = switchHandler();
	origin.handler.setRuleState({ phase: RulePhase.Item, activeTeam: 0, turnNumber: 0, itemUses: 0 });
	const recorder = new ReplayRecorder(origin.handler.toSettings(), 456);
	recorder.recordItemUse(ACTOR_ID, switchItem.id, { type: "entity", entityId: ALLY_ID });
	const replay = new ReplayPlayer(recorder.getReplay());
	replay.playAll();
	expect(replay.getHandler().getEntityManager().getEntityById(ACTOR_ID)?.getPos()).toEqual(live.actor.getPos());
	expect(replay.getHandler().getEntityManager().getEntityById(ALLY_ID)?.getPos()).toEqual(live.ally.getPos());
});
