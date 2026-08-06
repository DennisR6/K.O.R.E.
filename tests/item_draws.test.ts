import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createItemDocument } from "../src/item/types.ts";
import { RulePhase, WinCondition, type RuleState } from "../src/rules/types.ts";
import { createDefaultGameSettings, validateGameSettings } from "../src/settings/settings.ts";

function createDrawSettings() {
	return {
		...createDefaultGameSettings(2, 1),
		items: [createItemDocument({ id: "dash", useLimit: { perTurn: 5, perGame: 5 } }), createItemDocument({ id: "freeze", useLimit: { perTurn: 5, perGame: 5 } })],
		gameMode: {
			id: "draw-test",
			phases: [RulePhase.Physics],
			maxItemsPerTurn: 0,
			winCondition: WinCondition.LastTeamStanding,
			itemEconomy: {
				fixedLoadouts: [],
				mapPickups: [],
				randomDraw: { seed: 1234, itemIds: ["dash", "freeze"], drawsPerTurn: 2 },
			},
		},
	};
}

function nextTurn(activeTeam: number, turnNumber: number): RuleState {
	return { phase: RulePhase.Physics, activeTeam, turnNumber, itemUses: 0 };
}

test("seeded item draws repeat the same turn sequence", () => {
	const first = new GameHandlerBuilder().fromSettings(createDrawSettings()).build();
	const second = new GameHandlerBuilder().fromSettings(createDrawSettings()).build();

	for (const state of [nextTurn(1, 1), nextTurn(0, 2), nextTurn(1, 3)]) {
		first.startTurn(state);
		second.startTurn(state);
	}

	expect(first.toSettings().players.map(player => player.inventory)).toEqual(second.toSettings().players.map(player => player.inventory));
	expect(first.toSettings().itemDrawState).toEqual(second.toSettings().itemDrawState);
});

test("item draw state resumes after restoring an engine snapshot", () => {
	const original = new GameHandlerBuilder().fromSettings(createDrawSettings()).build();
	const initialSnapshot = original.toSettings();
	original.startTurn(nextTurn(1, 1));
	const restored = new GameHandlerBuilder().fromSettings(JSON.parse(JSON.stringify(original.toSettings()))).build();

	original.startTurn(nextTurn(0, 2));
	restored.startTurn(nextTurn(0, 2));

	expect(restored.toSettings().players.map(player => player.inventory)).toEqual(original.toSettings().players.map(player => player.inventory));
	expect(restored.toSettings().itemDrawState).toEqual(original.toSettings().itemDrawState);

	original.rematch();
	expect(original.toSettings().players.map(player => player.inventory)).toEqual(initialSnapshot.players.map(player => player.inventory));
	expect(original.toSettings().itemDrawState).toEqual(initialSnapshot.itemDrawState);
});

test("seeded item draws reject pool IDs not declared by the game", () => {
	const settings = createDrawSettings();
	settings.gameMode.itemEconomy.randomDraw!.itemIds = ["missing"];
	expect(() => validateGameSettings(settings)).toThrow("unknown item");
	expect(() => new GameHandlerBuilder().fromSettings(settings).build()).toThrow("unknown item 'missing'");
});
