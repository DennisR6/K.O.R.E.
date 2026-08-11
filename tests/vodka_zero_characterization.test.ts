import { expect, test } from "bun:test";
import { EffectAimVariance } from "../src/effects/aimVariance.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { GameState } from "../src/kore/runtime/types.ts";
import { createRuntimeItemEffect } from "../src/kore/sdk/itemRuntime.ts";
import { vodkaZeroItem } from "../src/item/officialItems.ts";
import { ItemEffectType } from "../src/effects/types.ts";
import { RulePhase, WinCondition } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { AiTurnEmitter, type IAiTurnProducer } from "../src/ai/aiEmitter.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";

const firstUser = "11111111-1111-4111-8111-111111111111";
const secondUser = "22222222-2222-4222-8222-222222222222";

function buildVodkaSettings() {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = [vodkaZeroItem];
	settings.gameMode = {
		id: "vodka-zero-characterization",
		phases: [RulePhase.Item, RulePhase.Physics],
		maxItemsPerTurn: 1,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: {
			fixedLoadouts: [{ team: 0, items: [{ itemId: vodkaZeroItem.id, uses: 1 }] }],
			mapPickups: [],
		},
	};
	return settings;
}

test("legacy Vodka-Zero defines a seeded additive offset and preserves power", () => {
	const first = new EffectAimVariance({ typeValue: { maxVarianceDegrees: 10, seed: 12345 } });
	const second = new EffectAimVariance({ typeValue: { maxVarianceDegrees: 10, seed: 12345 } });

	const result = first.applyToForce({ angle: 90, power: 5 });

	expect(result).toEqual(second.applyToForce({ angle: 90, power: 5 }));
	expect(result.power).toBe(5);
	expect(result.angle).toBeGreaterThanOrEqual(80);
	expect(result.angle).toBeLessThanOrEqual(100);
});

test("official Vodka-Zero runtime construction uses the declarative default seed", () => {
	const runtime = createRuntimeItemEffect({ type: ItemEffectType.AimVariance, typeValue: { maxVarianceDegrees: 10 } });

	expect(runtime).toEqual({ action: "aim", operation: "random-offset", maxVarianceDegrees: 10, randomState: 1337 });
});

test("qualified production stores Vodka-Zero as a one-shot pending action modifier", () => {
	const settings = buildVodkaSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 1701);

	emitter.sendItemUse(actor.getId(), vodkaZeroItem.id, { type: "self" });

	expect(actor.getInventory()[0]!.remainingUses).toBe(0);
	expect(actor.getPendingActionModifiers()).toMatchObject([{ action: "aim", operation: "random-offset", maxVarianceDegrees: 10, randomState: 1337, remainingUses: 1, sourceId: vodkaZeroItem.id }]);
	expect(actor.getItemEffects()).toEqual([]);

	emitter.skipPhase();
	handler.applyRawTurn({ actorId: actor.getId(), angle: 90, power: 4 });

	const expected = new EffectAimVariance({ typeValue: { maxVarianceDegrees: 10, seed: 1337 } }).applyToForce({ angle: 90, power: 4 });
	expect(actor.getVel().x).toBeCloseTo(Math.cos(expected.angle * Math.PI / 180) * expected.power);
	expect(actor.getVel().y).toBeCloseTo(Math.sin(expected.angle * Math.PI / 180) * expected.power);
	expect(actor.getPendingActionModifiers()).toEqual([]);
});

test("rejected shots do not mutate Vodka-Zero state or replay actions", () => {
	const settings = buildVodkaSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 1702);
	emitter.sendItemUse(actor.getId(), vodkaZeroItem.id, { type: "self" });
	emitter.skipPhase();
	const before = actor.getItemEffects();

	expect(() => emitter.sendShot(actor.getId(), 0, 11)).toThrow("Invalid shot input");

	expect(actor.getItemEffects()).toEqual(before);
	expect(emitter.recorder.getReplay().actions).toHaveLength(1);
	expect(handler.getState()).not.toBe(GameState.Playing);
});

test("snapshot restore reproduces the same next Vodka-Zero action", () => {
	const settings = buildVodkaSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 1703);
	emitter.sendItemUse(actor.getId(), vodkaZeroItem.id, { type: "self" });
	const snapshot = JSON.parse(JSON.stringify(handler.toSettings()));
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();

	handler.applyRawTurn({ actorId: actor.getId(), angle: 359, power: 4 });
	const restoredActor = restored.getEntityManager().getEntityById(actor.getId())!;
	restored.applyRawTurn({ actorId: restoredActor.getId(), angle: 359, power: 4 });

	expect(restoredActor.toSettings()).toEqual(actor.toSettings());
});

test("replay preserves raw Vodka-Zero intent and reconstructs the same result", () => {
	const settings = buildVodkaSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 1704);
	emitter.sendItemUse(actor.getId(), vodkaZeroItem.id, { type: "self" });
	emitter.skipPhase();
	emitter.sendShot(actor.getId(), 359, 4);
	while (handler.getState() === GameState.Playing) handler.tick();
	const replay = emitter.recorder.getReplay();

	expect(replay.actions.at(-1)).toMatchObject({ type: "shoot", input: { angle: 359, power: 4 } });
	expect(new ReplayPlayer(replay).playAll()).toEqual(handler.getEntityManager().serialize());
});

test("AI raw shots use the same generic Vodka-Zero action boundary", () => {
	const settings = buildVodkaSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 1705);
	emitter.sendItemUse(actor.getId(), vodkaZeroItem.id, { type: "self" });
	emitter.skipPhase();
	const producer: IAiTurnProducer = { computeTurn: () => ({ shot: { actorId: actor.getId(), angle: 90, power: 4 } }) };

	expect(new AiTurnEmitter(producer).executeTurn(handler, { difficulty: "easy", seed: 1, team: 0 }, emitter)).toBe(true);
	while (handler.getState() === GameState.Playing) handler.tick();

	expect(actor.getPendingActionModifiers()).toEqual([]);
	expect(emitter.recorder.getReplay().actions.at(-1)).toMatchObject({ type: "shoot", input: { angle: 90, power: 4 } });
});

test("authoritative network turn resolution applies Vodka-Zero server-side to raw input", () => {
	const registry = new GameRegistry(new GameDatabase(":memory:"));
	const record = registry.create(buildVodkaSettings(), [firstUser, secondUser]);
	const actor = record.handler.getEntityManager().getEntities()[0]!;

	expect(registry.submitItemUse(firstUser, actor.getId(), vodkaZeroItem.id, { type: "self" }).ok).toBe(true);
	record.ruleState = record.rules.advancePhase(record.ruleState);
	record.handler.setRuleState(record.ruleState);

	const result = registry.submitTurn(firstUser, { actorId: actor.getId(), angle: 90, power: 4 });

	expect(result.ok).toBe(true);
	if (!result.ok) throw new Error(result.error);
	expect(result.packet.input).toEqual({ angle: 90, power: 4 });
	expect(actor.getPendingActionModifiers()).toEqual([]);
});
