import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { NetworkEmitter, installTurnReceiver } from "../src/emitter/NetworkEmitter.ts";
import { createItemDocument } from "../src/item/types.ts";
import type { ItemTarget } from "../src/item/target.ts";
import { RulePhase, WinCondition } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { NetworkMessageType } from "../src/server/types.ts";

function settings() {
	const item = createItemDocument({ id: "switch", targetType: "self", useLimit: { perTurn: 1, perGame: 1 } });
	return {
		...createDefaultGameSettings(2, 1),
		items: [item],
		gameMode: {
			id: "local-item",
			phases: [RulePhase.Item, RulePhase.Physics],
			maxItemsPerTurn: 1,
			winCondition: WinCondition.LastTeamStanding,
			itemEconomy: { fixedLoadouts: [{ team: 0, items: [{ itemId: item.id, uses: 1 }] }], mapPickups: [] },
		},
	};
}

test("local emitter applies item use and advances authoritative item state", () => {
	const gameSettings = settings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(gameSettings).build();
	const actor = handler.getEntityManager().getEntities()[0];
	const emitter = new GameEmitter(handler, gameSettings.gameMode, 2);
	emitter.sendItemUse(actor.getId(), "switch", { type: "self" });

	expect(handler.getRuleState()).toEqual({ phase: RulePhase.Item, activeTeam: 0, turnNumber: 0, itemUses: 1 });
	expect(actor.getInventory()).toEqual([{ itemId: "switch", remainingUses: 0, usesThisTurn: 1 }]);
});

test("network emitter sends a declarative item target", () => {
	const sent: string[] = [];
	const socket = { send: (message: string) => sent.push(message) } as unknown as WebSocket;
	const target: ItemTarget = { type: "position", position: { x: 20, y: 30 } };
	new NetworkEmitter(socket).sendItemUse("actor", "magnet", target);
	expect(JSON.parse(sent[0])).toEqual({ type: NetworkMessageType.USE_ITEM, actorId: "actor", itemId: "magnet", target });
});

test("ITEM_USED reconciles client inventories and rule state", () => {
	const gameSettings = settings();
	const serverHandler = new GameHandlerBuilder().defaultSystems().fromSettings(gameSettings).build();
	const actor = serverHandler.getEntityManager().getEntities()[0];
	serverHandler.useItem(actor.getId(), "switch", { type: "self" });
	serverHandler.setRuleState({ phase: RulePhase.Item, activeTeam: 0, turnNumber: 0, itemUses: 1 });

	const clientHandler = new GameHandlerBuilder().defaultSystems().fromSettings(gameSettings).build();
	let listener: ((event: MessageEvent) => void) | undefined;
	const socket = {
		addEventListener: (_type: string, callback: (event: MessageEvent) => void) => { listener = callback; },
	} as unknown as WebSocket;
	installTurnReceiver(socket, clientHandler);
	listener?.({ data: JSON.stringify({
		 type: NetworkMessageType.ITEM_USED,
		 actorId: actor.getId(),
		 itemId: "switch",
		 target: { type: "self" },
		 ruleState: serverHandler.getRuleState(),
		 players: serverHandler.toSettings().players,
	}) } as MessageEvent);

	const clientActor = clientHandler.getEntityManager().getEntityById(actor.getId())!;
	expect(clientActor.getInventory()).toEqual([{ itemId: "switch", remainingUses: 0, usesThisTurn: 1 }]);
	expect(clientHandler.getRuleState().itemUses).toBe(1);
});
