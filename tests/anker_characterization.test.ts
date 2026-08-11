import { expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { ankerItem } from "../src/item/officialItems.ts";
import { RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { installTurnReceiver } from "../src/emitter/NetworkEmitter.ts";
import { NetworkMessageType } from "../src/server/types.ts";

function buildSettings() {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = [ankerItem];
	settings.gameMode = {
		id: "anker-characterization",
		phases: [RulePhase.Item, RulePhase.Physics],
		maxItemsPerTurn: 1,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: {
			fixedLoadouts: [{ team: 0, items: [{ itemId: ankerItem.id, uses: 2 }] }],
			mapPickups: [],
		},
	} satisfies GameModeSettings;
	return settings;
}

test("Anker persists for two turn intervals and applies force scaling to each accepted shot", () => {
	const settings = buildSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 404);

	emitter.sendItemUse(actor.getId(), ankerItem.id, { type: "self" });

	expect(actor.getInventory().find(item => item.itemId === ankerItem.id)).toEqual({ itemId: ankerItem.id, remainingUses: 1, usesThisTurn: 1 });
	expect(actor.getPendingActionModifiers()).toMatchObject([{ action: "force", operation: "scale", factor: 0.5, durationUnit: "turns", duration: 2, remaining: 2, sourceId: ankerItem.id }]);
	expect(actor.getItemEffects()).toEqual([]);
	emitter.skipPhase();
	handler.applyRawTurn({ actorId: actor.getId(), angle: 0, power: 8 });
	expect(actor.getVel()).toEqual({ x: 4, y: 0 });

	handler.setTurnNumber(1);
	expect(actor.getPendingActionModifiers()[0]!.remaining).toBe(1);
	handler.applyRawTurn({ actorId: actor.getId(), angle: 0, power: 8 });
	expect(actor.getVel()).toEqual({ x: 8, y: 0 });

	handler.setTurnNumber(2);
	expect(actor.getPendingActionModifiers()).toEqual([]);
});

test("Anker lifetime restores and replay preserves the accepted-action result", () => {
	const settings = buildSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 505);
	emitter.sendItemUse(actor.getId(), ankerItem.id, { type: "self" });

	const snapshot = JSON.parse(JSON.stringify(handler.toSettings()));
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();
	const restoredActor = restored.getEntityManager().getEntityById(actor.getId())!;
	expect(restoredActor.getPendingActionModifiers()).toEqual(actor.getPendingActionModifiers());
	restored.skipCurrentPhase();
	restored.applyRawTurn({ actorId: restoredActor.getId(), angle: 0, power: 8 });
	expect(restoredActor.getVel()).toEqual({ x: 4, y: 0 });

	const replayHandler = new GameHandlerBuilder().defaultSystems().fromSettings(buildSettings()).build();
	const replayActor = replayHandler.getEntityManager().getEntities()[0]!;
	const replayEmitter = new GameEmitter(replayHandler, settings.gameMode!, 2, 506);
	replayEmitter.sendItemUse(replayActor.getId(), ankerItem.id, { type: "self" });
	replayEmitter.skipPhase();
	replayEmitter.sendShot(replayActor.getId(), 0, 8);
	const replayFinal = new ReplayPlayer(replayEmitter.recorder.getReplay()).playAll().find(player => player.id === replayActor.getId())!;
	expect(replayFinal.position).toEqual(replayHandler.exportGame().logs[0]!.finalState.find(player => player.id === replayActor.getId())!.position);
});

test("Anker pending lifetime reconciles through the ordinary network ITEM_USED snapshot", () => {
	const settings = buildSettings();
	const server = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = server.getEntityManager().getEntities()[0]!;
	server.useItem(actor.getId(), ankerItem.id, { type: "self" });

	const client = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	let listener: ((event: MessageEvent) => void) | undefined;
	const socket = { addEventListener: (_type: string, callback: (event: MessageEvent) => void) => { listener = callback; } } as unknown as WebSocket;
	installTurnReceiver(socket, client);
	listener?.({ data: JSON.stringify({
		type: NetworkMessageType.ITEM_USED,
		actorId: actor.getId(),
		itemId: ankerItem.id,
		target: { type: "self" },
		ruleState: server.getRuleState(),
		players: server.toSettings().players,
	}) } as MessageEvent);

	const clientActor = client.getEntityManager().getEntityById(actor.getId())!;
	expect(clientActor.getPendingActionModifiers()).toEqual(actor.getPendingActionModifiers());
});
