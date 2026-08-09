import { expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameState } from "../src/engine/types.ts";
import { RulePhase } from "../src/rules/types.ts";
import { createCanonicalPlayableMatchHandler, createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.ts";
import { ItemPhaseUI } from "../src/ui/ItemPhaseUI.ts";

test("canonical gameplay exposes inventory, item allowance, skip, and physics transition", () => {
	const settings = createCanonicalPlayableMatchSettings();
	const handler = createCanonicalPlayableMatchHandler();
	const actor = handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!;
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 1407);
	const itemUI = new ItemPhaseUI(handler, emitter);

	expect(itemUI.getPhaseState()).toMatchObject({ phase: RulePhase.Item, activeTeam: 0, canUseItems: true, canSkip: true });
	expect(itemUI.getItems(actor.getId())).toEqual([
		{ itemId: "power-dash", remainingUses: 1, usesThisTurn: 0 },
		{ itemId: "mystery-box", remainingUses: 1, usesThisTurn: 0 },
	]);
	itemUI.use(actor.getId(), "power-dash");
	expect(itemUI.getPhaseState().itemUses).toBe(1);
	expect(itemUI.getItems(actor.getId())).toEqual([{ itemId: "mystery-box", remainingUses: 1, usesThisTurn: 0 }]);
	expect(() => itemUI.use(actor.getId(), "power-dash")).toThrow("allowance");

	itemUI.skip();
	expect(itemUI.getPhaseState()).toMatchObject({ phase: RulePhase.Physics, canUseItems: false, canSkip: false });
	expect(() => itemUI.use(actor.getId(), "power-dash")).toThrow("item phase");
	expect(() => emitter.sendShot(actor.getId(), 220, 10)).not.toThrow();
	handler.startTurn({ phase: RulePhase.Item, activeTeam: 0, turnNumber: 0, itemUses: 0 });
	handler.setState(GameState.Your_turn);
	handler.updateMouse(132, 162);
	handler.handleMousePressed();
	handler.updateMouse(232, 162);
	handler.handleMouseReleased();
	expect(handler.getState()).toBe(GameState.Your_turn);
});

test("a shot cannot bypass the canonical item phase and stale inventory is detached", () => {
	const settings = createCanonicalPlayableMatchSettings();
	const handler = createCanonicalPlayableMatchHandler();
	const actor = handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!;
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 1408);
	const itemUI = new ItemPhaseUI(handler, emitter);

	expect(() => emitter.sendShot(actor.getId(), 0, 1)).toThrow("physics phase");
	const available = itemUI.getItems(actor.getId());
	available[0]!.remainingUses = 0;
	expect(itemUI.getItems(actor.getId())[0]!.remainingUses).toBe(1);
	itemUI.skip();
	expect(() => itemUI.skip()).toThrow("current phase");
});
