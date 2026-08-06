import { expect, test } from "bun:test";
import { RulePhase, WinCondition } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { createItemDocument } from "../src/item/types.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { GameDatabase } from "../src/server/db.ts";
import { NetworkMessageType } from "../src/server/types.ts";
import { ServerRuntime, type ServerSocket } from "../src/server/runtime.ts";

const firstUser = "11111111-1111-4111-8111-111111111111";
const secondUser = "22222222-2222-4222-8222-222222222222";

function itemSettings() {
	const item = createItemDocument({ id: "switch", targetType: "self", useLimit: { perTurn: 1, perGame: 1 } });
	return {
		...createDefaultGameSettings(2, 1),
		items: [item],
		gameMode: {
			id: "item-turn",
			phases: [RulePhase.Item, RulePhase.Physics],
			maxItemsPerTurn: 1,
			winCondition: WinCondition.LastTeamStanding,
			itemEconomy: { fixedLoadouts: [{ team: 0, items: [{ itemId: item.id, uses: 1 }] }], mapPickups: [] },
		},
	};
}

test("authoritative item use requires item phase and active-team ownership", () => {
	const registry = new GameRegistry(new GameDatabase(":memory:"));
	const record = registry.create(itemSettings(), [firstUser, secondUser]);
	const actorId = record.handler.getEntityManager().getEntities()[0].getId();

	const accepted = registry.submitItemUse(firstUser, actorId, "switch", { type: "self" });
	expect(accepted.ok).toBe(true);
	expect(record.ruleState.itemUses).toBe(1);
	expect(record.handler.getEntityManager().getEntityById(actorId)?.getInventory()).toEqual([{ itemId: "switch", remainingUses: 0, usesThisTurn: 1 }]);

	const exhausted = registry.submitItemUse(firstUser, actorId, "switch", { type: "self" });
	expect(exhausted).toEqual({ ok: false, error: "Item allowance has been exhausted" });

	const wrongTeam = registry.submitItemUse(secondUser, actorId, "switch", { type: "self" });
	expect(wrongTeam).toEqual({ ok: false, error: "It is not your turn" });
});

test("authoritative item use rejects requests outside the item phase", () => {
	const settings = itemSettings();
	settings.gameMode = { ...settings.gameMode, phases: [RulePhase.Physics], maxItemsPerTurn: 0, itemEconomy: { fixedLoadouts: [], mapPickups: [] } };
	const registry = new GameRegistry(new GameDatabase(":memory:"));
	const record = registry.create(settings, [firstUser, secondUser]);
	const actorId = record.handler.getEntityManager().getEntities()[0].getId();
	expect(registry.submitItemUse(firstUser, actorId, "switch", { type: "self" })).toEqual({ ok: false, error: "Items may only be used during the item phase" });
});

class FakeSocket implements ServerSocket {
	public sent: string[] = [];
	constructor(public data: ServerSocket["data"]) {}
	public send(message: string): void { this.sent.push(message); }
}

test("runtime broadcasts an accepted item-use packet to both players", () => {
	const database = new GameDatabase(":memory:");
	const settings = itemSettings();
	const registry = new GameRegistry(database);
	const record = registry.create(settings, [firstUser, secondUser]);
	const runtime = new ServerRuntime(registry);
	const first = new FakeSocket({ connectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
	const second = new FakeSocket({ connectionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
	runtime.open(first);
	runtime.open(second);
	runtime.message(first, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: firstUser }));
	runtime.message(second, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: secondUser }));
	runtime.message(first, JSON.stringify({ type: NetworkMessageType.USE_ITEM, actorId: "actor", itemId: "switch", target: { type: "self" } }));
	expect(JSON.parse(first.sent.at(-1)!).message).toBe("Actor is not active");
	const actorId = record.handler.getEntityManager().getEntities()[0].getId();
	runtime.message(first, JSON.stringify({ type: NetworkMessageType.USE_ITEM, actorId, itemId: "switch", target: { type: "self" } }));
	const firstPacket = JSON.parse(first.sent.at(-1)!);
	const secondPacket = JSON.parse(second.sent.at(-1)!);
	expect(firstPacket).toEqual(secondPacket);
	expect(firstPacket.type).toBe(NetworkMessageType.ITEM_USED);
	expect(firstPacket.ruleState.itemUses).toBe(1);
});
