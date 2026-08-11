import { expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { GameState } from "../src/kore/runtime/types.ts";
import { jaegermeisterElixierItem, magnetItem } from "../src/item/officialItems.ts";
import { RulePhase, WinCondition } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { UiSystem } from "../src/systems/UiSystem.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { createActorEligibilityConstraint, createActorEligibilityConstraintLifetime } from "../src/engine/contracts/actorEligibility.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { AiTurnEmitter, type IAiTurnProducer } from "../src/ai/aiEmitter.ts";
import { validateItemTarget } from "../src/item/target.ts";
import { ItemPhaseUI } from "../src/ui/ItemPhaseUI.ts";

const firstUser = "11111111-1111-4111-8111-111111111111";
const secondUser = "22222222-2222-4222-8222-222222222222";

function buildSettings() {
	const settings = createDefaultGameSettings(2, 1);
	settings.players[0]!.position = { x: 200, y: 200 };
	settings.players[1]!.position = { x: 260, y: 200 };
	settings.items = [jaegermeisterElixierItem];
	settings.gameMode = {
		id: "selection-lock-characterization",
		phases: [RulePhase.Item, RulePhase.Physics],
		maxItemsPerTurn: 1,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: {
			fixedLoadouts: [{ team: 0, items: [{ itemId: jaegermeisterElixierItem.id, uses: 1 }] }],
			mapPickups: [],
		},
	};
	return settings;
}

test("qualified Selection Lock installs canonical actor exclusion and rejects the locked shot", () => {
	const settings = buildSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const [actor, target] = handler.getEntityManager().getEntities();
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 3301);

	emitter.sendItemUse(actor!.getId(), jaegermeisterElixierItem.id, { type: "entity", entityId: target!.getId() });

	expect(actor!.getInventory()[0]!.remainingUses).toBe(0);
	expect(target!.getItemEffects()).toEqual([]);
	expect(target!.getActorEligibilityConstraints()).toMatchObject([{ mode: "excluded", sourceId: jaegermeisterElixierItem.id }]);
	emitter.skipPhase();
	handler.setActiveTeam(1);
	expect(() => emitter.sendShot(target!.getId(), 0, 1)).toThrow("locked from selection");
	expect(emitter.recorder.getReplay().actions).toMatchObject([{ type: "itemUse", itemId: jaegermeisterElixierItem.id }]);
});

test("UiSystem projects canonical actor ineligibility by rejecting a locked actor", () => {
	const settings = buildSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const [actor, target] = handler.getEntityManager().getEntities();
	target!.addActorEligibilityConstraint(
		createActorEligibilityConstraint({ id: "ui-lock", mode: "excluded" }),
		createActorEligibilityConstraintLifetime({ id: "ui-lock:lifetime", constraintId: "ui-lock", durationUnit: "turns", duration: 2, remaining: 2 }),
	);
	target!.setInventory([{ itemId: jaegermeisterElixierItem.id, remainingUses: 1, usesThisTurn: 0 }]);
	const ui = new UiSystem();
	const context = handler.getContext();
	context.activeTeam = 1;
	context.state = GameState.Your_turn;
	ui.setAimAngle(target!.getId(), 0);
	ui.setChargePower(1);
	ui.ticker(context, 1, 1);

	expect(context.mouse.turn).toBeNull();
	expect(actor!.getId()).not.toBe(target!.getId());
});

test("Item phase UI projects the same actor eligibility state", () => {
	const settings = buildSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const [actor, target] = handler.getEntityManager().getEntities();
	target!.addActorEligibilityConstraint(
		createActorEligibilityConstraint({ id: "item-ui-lock", mode: "excluded" }),
		createActorEligibilityConstraintLifetime({ id: "item-ui-lock:lifetime", constraintId: "item-ui-lock", durationUnit: "turns", duration: 2, remaining: 2 }),
	);

	expect(ItemPhaseUI.getAvailableItems(handler, actor!.getId())).toHaveLength(1);
	expect(ItemPhaseUI.getAvailableItems(handler, target!.getId())).toEqual([]);
});

test("authoritative server rejects a locked actor while target validation remains unrelated", () => {
	const registry = new GameRegistry(new GameDatabase(":memory:"));
	const record = registry.create(buildSettings(), [firstUser, secondUser]);
	const [actor, target] = record.handler.getEntityManager().getEntities();

	expect(registry.submitItemUse(firstUser, actor!.getId(), jaegermeisterElixierItem.id, { type: "entity", entityId: target!.getId() }).ok).toBe(true);
	record.ruleState = record.rules.advancePhase(record.ruleState);
	record.handler.setRuleState(record.ruleState);
	expect(registry.submitTurn(firstUser, { actorId: actor!.getId(), angle: 0, power: 1 }).ok).toBe(true);
	record.ruleState = record.rules.advancePhase(record.ruleState);
	record.handler.setRuleState(record.ruleState);
	const result = registry.submitTurn(secondUser, { actorId: target!.getId(), angle: 0, power: 1 });

	expect(result).toEqual({ ok: false, error: "Actor is locked from selection" });
});

test("pre-migration Selection Lock preserves its remaining turn state through snapshot restore", () => {
	const settings = buildSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const [actor, target] = handler.getEntityManager().getEntities();
	handler.useItem(actor!.getId(), jaegermeisterElixierItem.id, { type: "entity", entityId: target!.getId() });
	handler.setTurnNumber(1);
	const snapshot = JSON.parse(JSON.stringify(handler.toSettings()));
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();

	expect(restored.toSettings()).toEqual(snapshot);
	expect(restored.getEntityManager().getEntityById(target!.getId())!.getActorEligibilityConstraints()).toEqual(target!.getActorEligibilityConstraints());
});

test("Selection Lock expires at the shared turn boundary and direct Handler validation follows it", () => {
	const settings = buildSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const [actor, target] = handler.getEntityManager().getEntities();
	handler.useItem(actor!.getId(), jaegermeisterElixierItem.id, { type: "entity", entityId: target!.getId() });
	handler.setActiveTeam(1);
	handler.setTurnNumber(1);
	expect(handler.isActorEligibleForAction(target!.getId())).toBe(false);
	handler.setTurnNumber(2);
	expect(handler.isActorEligibleForAction(target!.getId())).toBe(true);
	expect(() => handler.resolveTurn({ actorId: target!.getId(), angle: 0, power: 1 })).not.toThrow();
});

test("Selection Lock does not make the locked entity an invalid item target", () => {
	const settings = buildSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const [actor, target] = handler.getEntityManager().getEntities();
	target!.addActorEligibilityConstraint(
		createActorEligibilityConstraint({ id: "target-lock", mode: "excluded" }),
		createActorEligibilityConstraintLifetime({ id: "target-lock:lifetime", constraintId: "target-lock", durationUnit: "turns", duration: 2, remaining: 2 }),
	);

	expect(() => validateItemTarget(magnetItem, { type: "entity", entityId: target!.getId() }, {
		actor: actor!,
		entities: handler.getEntityManager().getEntities(),
		worldSize: handler.getContext().worldSize,
	})).not.toThrow();
});

test("AI filters a locked actor through the shared eligibility boundary", () => {
	const settings = buildSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const [actor, target] = handler.getEntityManager().getEntities();
	handler.useItem(actor!.getId(), jaegermeisterElixierItem.id, { type: "entity", entityId: target!.getId() });
	handler.setActiveTeam(1);
	handler.setTurnNumber(1);
	const producer: IAiTurnProducer = { computeTurn: () => ({ shot: { actorId: target!.getId(), angle: 0, power: 1 } }) };
	let submitted = 0;
	const emitter = { sendShot: () => { submitted++; } };

	expect(new AiTurnEmitter(producer).executeTurn(handler, { difficulty: "easy", seed: 1, team: 1 }, emitter)).toBe(false);
	expect(submitted).toBe(0);
	handler.setTurnNumber(2);
	expect(new AiTurnEmitter(producer).executeTurn(handler, { difficulty: "easy", seed: 1, team: 1 }, emitter)).toBe(true);
	expect(submitted).toBe(1);
});

test("replay restores Selection Lock and preserves raw accepted action intent", () => {
	const settings = buildSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 3302);
	emitter.sendItemUse(actor.getId(), jaegermeisterElixierItem.id, { type: "entity", entityId: handler.getEntityManager().getEntities()[1]!.getId() });
	emitter.skipPhase();
	emitter.sendShot(actor.getId(), 0, 1);
	while (handler.getState() === GameState.Playing) handler.tick();

	const replay = emitter.recorder.getReplay();
	expect(replay.actions).toMatchObject([
		{ type: "itemUse", itemId: jaegermeisterElixierItem.id },
		{ type: "shoot", actorId: actor.getId(), input: { angle: 0, power: 1 } },
	]);
	expect(new ReplayPlayer(replay).playAll()).toEqual(handler.getEntityManager().serialize());
});
