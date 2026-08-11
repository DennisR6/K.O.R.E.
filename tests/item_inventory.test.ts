import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { createItemDocument } from "../src/item/types.ts";
import { RulePhase, WinCondition } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

test("fixed loadouts initialize per player and consume within item limits", () => {
	const item = createItemDocument({ id: "anchor", useLimit: { perTurn: 1, perGame: 2 } });
	const settings = {
		...createDefaultGameSettings(2, 2),
		items: [item],
		gameMode: {
			id: "loadout-test",
			phases: [RulePhase.Physics],
			maxItemsPerTurn: 0,
			winCondition: WinCondition.LastTeamStanding,
			itemEconomy: {
				fixedLoadouts: [{ team: 0, items: [{ itemId: item.id, uses: 3 }] }],
				mapPickups: [],
			},
		},
	};
	const handler = new GameHandlerBuilder().fromSettings(settings).build();
	const [first, second, opponent] = handler.getEntityManager().getEntities();

	expect(first.getInventory()).toEqual([{ itemId: item.id, remainingUses: 2, usesThisTurn: 0 }]);
	expect(second.getInventory()).toEqual([{ itemId: item.id, remainingUses: 2, usesThisTurn: 0 }]);
	expect(opponent.getInventory()).toEqual([]);

	handler.useItem(first.getId(), item.id);
	expect(first.getInventory()).toEqual([{ itemId: item.id, remainingUses: 1, usesThisTurn: 1 }]);
	expect(() => handler.useItem(first.getId(), item.id)).toThrow("per-turn limit");

	const restored = new GameHandlerBuilder().fromSettings(handler.toSettings()).build();
	const restoredFirst = restored.getEntityManager().getEntityById(first.getId())!;
	expect(restoredFirst.getInventory()).toEqual([{ itemId: item.id, remainingUses: 1, usesThisTurn: 1 }]);

	restored.setTurnNumber(1);
	restored.useItem(restoredFirst.getId(), item.id);
	expect(restoredFirst.getInventory()).toEqual([{ itemId: item.id, remainingUses: 0, usesThisTurn: 1 }]);
	expect(() => restored.useItem(restoredFirst.getId(), item.id)).toThrow("no remaining uses");

	handler.rematch();
	expect(first.getInventory()).toEqual([{ itemId: item.id, remainingUses: 2, usesThisTurn: 0 }]);
});
