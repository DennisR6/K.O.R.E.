import { expect, test } from "bun:test";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { RulePhase, WinCondition } from "../src/rules/types.ts";
import { kore } from "../src/kore/sdk/index.js";
import { freezeShotItem, FREEZE_SHOT_DURATION_TURNS, FREEZE_SHOT_SPEED_FACTOR } from "../src/item/officialItems.ts";

const firstUser = "11111111-1111-4111-8111-111111111111";
const secondUser = "22222222-2222-4222-8222-222222222222";

function freezeSettings() {
	const settings = createDefaultGameSettings(2, 1);
	const actor = settings.players[0]!;
	const target = settings.players[1]!;
	actor.position = { x: 200, y: 200 };
	target.position = { x: 260, y: 200 };
	actor.velocity = { x: 0, y: 0 };
	target.velocity = { x: 8, y: 4 };
	return {
		...settings,
		items: [freezeShotItem],
		gameMode: {
			id: "freeze-characterization",
			phases: [RulePhase.Item, RulePhase.Physics],
			maxItemsPerTurn: 1,
			winCondition: WinCondition.LastTeamStanding,
			itemEconomy: { fixedLoadouts: [{ team: 0, items: [{ itemId: freezeShotItem.id, uses: 1 }] }], mapPickups: [] },
		},
	};
}

test("Freeze-Shot records activation, target, and generic temporal runtime state", () => {
	const registry = new GameRegistry(new GameDatabase(":memory:"));
	const record = registry.create(freezeSettings(), [firstUser, secondUser]);
	const [actor, target] = record.handler.getEntityManager().getEntities();
	const before = target!.getVel();

	const result = registry.submitItemUse(firstUser, actor!.getId(), freezeShotItem.id, { type: "entity", entityId: target!.getId() });

	expect(result.ok).toBe(true);
	expect(record.ruleState.phase).toBe(RulePhase.Item);
	expect(target!.getVel()).toEqual(before);
	expect(target!.getTemporalModifiers()).toHaveLength(1);
	expect(target!.getTemporalModifiers()[0]).toMatchObject({ durationUnit: "turns", duration: FREEZE_SHOT_DURATION_TURNS, remaining: FREEZE_SHOT_DURATION_TURNS, target: { type: "entity", entityId: target!.getId() } });
	expect(target!.getTemporalModifiers()[0]!.effect).toMatchObject({ type: "movement.scale-speed", typeValue: { factor: FREEZE_SHOT_SPEED_FACTOR } });
});

test("Freeze-Shot applies movement scaling once per action and expires without inverse restoration", () => {
	const registry = new GameRegistry(new GameDatabase(":memory:"));
	const record = registry.create(freezeSettings(), [firstUser, secondUser]);
	const [actor, target] = record.handler.getEntityManager().getEntities();
	registry.submitItemUse(firstUser, actor!.getId(), freezeShotItem.id, { type: "entity", entityId: target!.getId() });

	record.handler.applyRawTurn({ actorId: target!.getId(), angle: 0, power: 0 });
	expect(target!.getVel()).toEqual({ x: 2, y: 1 });
	record.handler.setTurnNumber(1);
	expect(target!.getTemporalModifiers()[0]!.remaining).toBe(1);
	record.handler.setTurnNumber(2);
	expect(target!.getTemporalModifiers()).toEqual([]);
	target!.setVel({ x: 8, y: 4 });
	record.handler.applyRawTurn({ actorId: target!.getId(), angle: 0, power: 0 });
	expect(target!.getVel()).toEqual({ x: 8, y: 4 });
});

test("repeated Freeze-Shot uses stack factors and do not rescale on every physics tick", () => {
	const settings = freezeSettings();
	const handler = kore.createHandler(settings);
	const [actor, target] = handler.getEntityManager().getEntities();
	actor!.setInventory([{ itemId: freezeShotItem.id, remainingUses: 2, usesThisTurn: 0 }]);
	handler.useItem(actor!.getId(), freezeShotItem.id, { type: "entity", entityId: target!.getId() });
	handler.setTurnNumber(1);
	handler.useItem(actor!.getId(), freezeShotItem.id, { type: "entity", entityId: target!.getId() });
	expect(target!.getTemporalModifiers()).toHaveLength(2);
	target!.setVel({ x: 8, y: 4 });
	handler.applyRawTurn({ actorId: target!.getId(), angle: 0, power: 0 });
	expect(target!.getVel()).toEqual({ x: 0.5, y: 0.25 });
	handler.tick(0);
	expect(target!.getVel().x).toBeGreaterThan(0.4);
	expect(target!.getVel().y).toBeGreaterThan(0.2);
});

test("Freeze-Shot characterization rejects inactive targets and preserves the target snapshot on restore", () => {
	const registry = new GameRegistry(new GameDatabase(":memory:"));
	const record = registry.create(freezeSettings(), [firstUser, secondUser]);
	const [actor, target] = record.handler.getEntityManager().getEntities();
	target!.setIsDead(true);

	expect(registry.submitItemUse(firstUser, actor!.getId(), freezeShotItem.id, { type: "entity", entityId: target!.getId() })).toEqual({ ok: false, error: "Entity target must be an active entity" });

	target!.setIsDead(false);
	const accepted = registry.submitItemUse(firstUser, actor!.getId(), freezeShotItem.id, { type: "entity", entityId: target!.getId() });
	expect(accepted.ok).toBe(true);
	const snapshot = JSON.parse(JSON.stringify(record.handler.toSettings()));
	const restored = kore.restoreHandler(snapshot);
	expect(restored.toSettings()).toEqual(snapshot);
});
