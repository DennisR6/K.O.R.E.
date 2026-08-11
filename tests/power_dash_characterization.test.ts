import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { powerDashItem } from "../src/item/officialItems.ts";
import { RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { AiTurnEmitter } from "../src/ai/aiEmitter.ts";

function buildSettings() {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = [powerDashItem];
	settings.gameMode = {
		id: "power-dash-characterization",
		phases: [RulePhase.Item, RulePhase.Physics],
		maxItemsPerTurn: 1,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: {
			fixedLoadouts: [{ team: 0, items: [{ itemId: powerDashItem.id, uses: 1 }] }],
			mapPickups: [],
		},
	} satisfies GameModeSettings;
	return settings;
}

function buildHandler() {
	return new GameHandlerBuilder().defaultSystems().fromSettings(buildSettings()).build();
}

test("Power-Dash applies factor 1.5 at the accepted action boundary and consumes once", () => {
	const baseline = buildHandler();
	const boosted = buildHandler();
	const baselineActor = baseline.getEntityManager().getEntities()[0]!;
	const boostedActor = boosted.getEntityManager().getEntities()[0]!;

	const baselineEmitter = new GameEmitter(baseline, buildSettings().gameMode!, 2, 101);
	const boostedEmitter = new GameEmitter(boosted, buildSettings().gameMode!, 2, 101);
	boostedEmitter.sendItemUse(boostedActor.getId(), powerDashItem.id, { type: "self" });

	expect(boostedActor.getPendingActionModifiers()).toMatchObject([{ action: "force", operation: "scale", factor: 1.5, remainingUses: 1, sourceId: powerDashItem.id }]);
	baselineEmitter.skipPhase();
	boostedEmitter.skipPhase();
	baseline.applyRawTurn({ actorId: baselineActor.getId(), angle: 0, power: 4 });
	boosted.applyRawTurn({ actorId: boostedActor.getId(), angle: 0, power: 4 });

	expect(baselineActor.getVel()).toEqual({ x: 4, y: 0 });
	expect(boostedActor.getVel()).toEqual({ x: 6, y: 0 });
	expect(boostedActor.getPendingActionModifiers()).toEqual([]);

	// The emitter's invalid-input boundary rejects before the modifier can be consumed.
	const pending = buildHandler();
	const pendingActor = pending.getEntityManager().getEntities()[0]!;
	const pendingEmitter = new GameEmitter(pending, buildSettings().gameMode!, 2, 101);
	pendingEmitter.sendItemUse(pendingActor.getId(), powerDashItem.id, { type: "self" });
	pendingEmitter.skipPhase();
	expect(() => pendingEmitter.sendShot(pendingActor.getId(), 0, 0)).toThrow("Invalid shot input");
	expect(pendingActor.getPendingActionModifiers()).toHaveLength(1);
});

test("Power-Dash survives a pending snapshot and replay through the shared action path", () => {
	const handler = buildHandler();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, buildSettings().gameMode!, 2, 202);
	emitter.sendItemUse(actor.getId(), powerDashItem.id, { type: "self" });

	const pendingSnapshot = JSON.parse(JSON.stringify(handler.toSettings()));
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(pendingSnapshot).build();
	const restoredActor = restored.getEntityManager().getEntityById(actor.getId())!;
	expect(restoredActor.getPendingActionModifiers()).toEqual(actor.getPendingActionModifiers());
	restored.skipCurrentPhase();
	restored.applyRawTurn({ actorId: restoredActor.getId(), angle: 0, power: 4 });
	expect(restoredActor.getVel()).toEqual({ x: 6, y: 0 });
	expect(restoredActor.getPendingActionModifiers()).toEqual([]);

	const replayHandler = buildHandler();
	const replayActor = replayHandler.getEntityManager().getEntities()[0]!;
	const replayEmitter = new GameEmitter(replayHandler, buildSettings().gameMode!, 2, 203);
	replayEmitter.sendItemUse(replayActor.getId(), powerDashItem.id, { type: "self" });
	replayEmitter.skipPhase();
	replayEmitter.sendShot(replayActor.getId(), 0, 4);
	const replayFinal = new ReplayPlayer(replayEmitter.recorder.getReplay()).playAll().find(player => player.id === replayActor.getId())!;
	expect(replayFinal.position).toEqual(replayHandler.exportGame().logs[0]!.finalState.find(player => player.id === replayActor.getId())!.position);
});

test("AI shots consume the same pending Power-Dash action modifier as human shots", () => {
	const handler = buildHandler();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, buildSettings().gameMode!, 2, 303);
	emitter.sendItemUse(actor.getId(), powerDashItem.id, { type: "self" });
	emitter.skipPhase();

	const ai = new AiTurnEmitter({
		computeTurn: () => ({ shot: { actorId: actor.getId(), angle: 0, power: 4 } }),
	});

	expect(ai.executeTurn(handler, { difficulty: "easy", seed: 1, team: 0 }, emitter)).toBe(true);
	expect(actor.getVel()).toEqual({ x: 6, y: 0 });
	expect(actor.getPendingActionModifiers()).toEqual([]);
});
