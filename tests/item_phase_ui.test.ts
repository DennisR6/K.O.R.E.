import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createItemDocument } from "../src/item/types.js";
import { RuleInterpreter } from "../src/rules/RuleInterpreter.ts";
import { RulePhase, WinCondition } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { ItemPhaseUI } from "../src/ui/ItemPhaseUI.ts";

function createItemPhaseSettings() {
	const item = createItemDocument({ id: "dash", targetType: "self", useLimit: { perTurn: 1, perGame: 3 } });
	return {
		...createDefaultGameSettings(2, 1),
		items: [item],
		gameMode: {
			id: "item-phase-mode",
			phases: [RulePhase.Item, RulePhase.Aim, RulePhase.Charge, RulePhase.Push, RulePhase.Physics],
			maxItemsPerTurn: 1,
			winCondition: WinCondition.LastTeamStanding,
			itemEconomy: {
				fixedLoadouts: [{ team: 0, items: [{ itemId: "dash", uses: 3 }] }],
				mapPickups: [],
			},
		},
	};
}

test("ItemPhaseUI lists available items and validates targets correctly", () => {
	const settings = createItemPhaseSettings();
	const handler = new GameHandlerBuilder().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;

	handler.startTurn({ phase: RulePhase.Item, activeTeam: 0, turnNumber: 0, itemUses: 0 });

	const available = ItemPhaseUI.getAvailableItems(handler, actor.getId());
	expect(available).toEqual([{ itemId: "dash", remainingUses: 3, usesThisTurn: 0 }]);

	// Valid self target
	const validationValid = ItemPhaseUI.validateTarget(handler, actor.getId(), "dash", { type: "self" });
	expect(validationValid.valid).toBe(true);

	// Invalid target type
	const validationInvalid = ItemPhaseUI.validateTarget(handler, actor.getId(), "dash", { type: "entity", entityId: "other" });
	expect(validationInvalid.valid).toBe(false);
});

test("ItemPhaseUI allows using items and skipping item phase", () => {
	const settings = createItemPhaseSettings();
	const handler = new GameHandlerBuilder().fromSettings(settings).build();
	const interpreter = new RuleInterpreter(settings.gameMode);
	const actor = handler.getEntityManager().getEntities()[0]!;

	handler.startTurn({ phase: RulePhase.Item, activeTeam: 0, turnNumber: 0, itemUses: 0 });

	ItemPhaseUI.useItem(handler, actor.getId(), "dash", { type: "self" });
	expect(actor.getInventory()[0]?.remainingUses).toBe(2);

	// Skip item phase
	ItemPhaseUI.skipItemPhase(handler, interpreter);
	expect(handler.getRuleState().phase).toBe(RulePhase.Aim);
});
