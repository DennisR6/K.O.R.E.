import { expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import { durchlaessigkeitItem, jaegermeisterElixierItem, vodkaZeroItem } from "../src/item/officialItems.ts";
import { RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

function buildSettings(item: typeof durchlaessigkeitItem | typeof jaegermeisterElixierItem | typeof vodkaZeroItem): GameModeSettings & ReturnType<typeof createDefaultGameSettings> {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = [item];
	settings.gameMode = {
		id: `remaining-item-${item.id}`,
		phases: [RulePhase.Item, RulePhase.Physics],
		maxItemsPerTurn: 1,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: {
			fixedLoadouts: [{ team: 0, items: [{ itemId: item.id, uses: 1 }] }],
			mapPickups: [],
		},
	};
	return settings as GameModeSettings & ReturnType<typeof createDefaultGameSettings>;
}

test("Ghost Mode is accepted and stored, but does not alter participation or PhysicsSystem collision behavior", () => {
	const settings = buildSettings(durchlaessigkeitItem);
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;

	handler.useItem(actor.getId(), durchlaessigkeitItem.id, { type: "self" });

	expect(actor.getItemEffects()).toMatchObject([{ type: "ghostMode", typeValue: { durationTurns: 2 } }]);
	expect(actor.physicsEnabled()).toBe(true);
	expect(actor.drawingEnabled()).toBe(true);
	expect(actor.isDead()).toBe(false);
});

test("Selection Lock is accepted and stored, but the shared shot boundary does not enforce selection eligibility", () => {
	const settings = buildSettings(jaegermeisterElixierItem);
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const [actor, target] = handler.getEntityManager().getEntities();
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 606);
	target!.setPos({ x: actor!.getPos().x + 100, y: actor!.getPos().y });

	emitter.sendItemUse(actor!.getId(), jaegermeisterElixierItem.id, { type: "entity", entityId: target!.getId() });
	expect(target!.getItemEffects()).toMatchObject([{ type: "selectionLock", typeValue: { durationTurns: 2 } }]);
	emitter.skipPhase();
	emitter.sendShot(actor!.getId(), 0, 1);
	let guard = 0;
	while (handler.getState() === GameState.Playing && guard++ < 1000) handler.tick();
	emitter.skipPhase();

	// Characterizes the current missing authoritative selection-policy check.
	expect(() => emitter.sendShot(target!.getId(), 0, 1)).not.toThrow();
});

test("Vodka-Zero is accepted and stored, but the accepted shot path does not apply its seeded aim variance", () => {
	const settings = buildSettings(vodkaZeroItem);
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 707);

	emitter.sendItemUse(actor.getId(), vodkaZeroItem.id, { type: "self" });
	expect(actor.getItemEffects()).toMatchObject([{ type: "aimVariance", typeValue: { maxVarianceDegrees: 10 } }]);
	emitter.skipPhase();
	handler.applyRawTurn({ actorId: actor.getId(), angle: 90, power: 4 });

	expect(actor.getVel().x).toBeCloseTo(0);
	expect(actor.getVel().y).toBe(4);
	expect(actor.getItemEffects()).toHaveLength(1);
});
