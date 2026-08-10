import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { NetworkEmitter, installTurnReceiver } from "../src/emitter/NetworkEmitter.ts";
import { EmitterSystem } from "../src/systems/Emitter.ts";
import { createItemDocument } from "../src/item/types.ts";
import type { ItemTarget } from "../src/item/target.ts";
import { RulePhase, WinCondition } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { NetworkMessageType } from "../src/server/types.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";

const userOne = "11111111-1111-4111-8111-111111111111";
const userTwo = "22222222-2222-4222-8222-222222222222";

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
	handler.setMyTeam([0]);
	const actor = handler.getEntityManager().getEntities()[0];
	const emitter = new GameEmitter(handler, gameSettings.gameMode, 2);
	emitter.sendItemUse(actor.getId(), "switch", { type: "self" });

	expect(handler.getRuleState()).toEqual({ phase: RulePhase.Item, activeTeam: 0, turnNumber: 0, itemUses: 1 });
	expect(actor.getInventory()).toEqual([{ itemId: "switch", remainingUses: 0, usesThisTurn: 1 }]);
});

test("local shot implicitly skips the optional item phase", () => {
	const gameSettings = settings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(gameSettings).build();
	handler.setMyTeam([0]);
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, gameSettings.gameMode, 2);

	emitter.sendShot(actor.getId(), 0, 1);

	expect(handler.getRuleState().phase).toBe(RulePhase.Physics);
	expect(handler.getState()).toBe(GameState.Playing);
});

test("authoritative shot implicitly skips the optional item phase", () => {
	const gameSettings = settings();
	const registry = new GameRegistry(new GameDatabase(":memory:"));
	const record = registry.create(gameSettings, [userOne, userTwo]);
	const actor = record.handler.getEntityManager().getEntities()[0]!;

	const result = registry.submitTurn(userOne, { actorId: actor.getId(), angle: 0, power: 1 });

	expect(result.ok).toBe(true);
	if (result.ok) expect(result.record.ruleState).toEqual({ phase: RulePhase.Item, activeTeam: 1, turnNumber: 1, itemUses: 0 });
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

test("network errors restore the actionable turn state", () => {
	const gameSettings = settings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(gameSettings).build();
	handler.setMyTeam([0]);
	handler.setState(GameState.Waiting_for_server);
	let listener: ((event: MessageEvent) => void) | undefined;
	const socket = {
		addEventListener: (_type: string, callback: (event: MessageEvent) => void) => { listener = callback; },
	} as unknown as WebSocket;
	installTurnReceiver(socket, handler);
	listener?.({ data: JSON.stringify({ type: NetworkMessageType.ERROR, message: "The game is not in the physics phase" }) } as MessageEvent);
	expect(handler.getState()).toBe(GameState.Your_turn);
});

test("restored emitter transport is replaceable for network startup", () => {
	const sent: string[] = [];
	const restored = new EmitterSystem();
	restored.setEmitter({ sendShot: () => { sent.push("shot"); } });
	restored.emitter.sendShot("actor", 0, 1);
	expect(sent).toEqual(["shot"]);
});
