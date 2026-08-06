import { expect, test } from "bun:test";
import { ActionManager, GameAction } from "../src/input/actions.ts";
import { createDefaultKoreInputBindings, KoreInputAction, KoreInputCommand, validateKoreInputBindings, validateKoreInputMessage } from "../src/kore/sdk/input.ts";

test("legacy action bindings consume the KORE SDK input profile", () => {
	const bindings = createDefaultKoreInputBindings();
	validateKoreInputBindings(bindings);
	const actions = new ActionManager();
	expect(actions.getConfig()).toEqual(bindings);
	expect(actions.getActionForKey("Space")).toBe(KoreInputAction.Charge);
	expect(GameAction.ItemUse).toBe(KoreInputAction.ItemUse);
});

test("KORE input command validation accepts semantic adapter messages and rejects malformed data", () => {
	expect(() => validateKoreInputMessage({ command: KoreInputCommand.PointerMove, payload: { x: 10, y: 20 } })).not.toThrow();
	expect(() => validateKoreInputMessage({ command: KoreInputCommand.ItemUse, payload: { actorId: "actor", itemId: "item", target: { type: "self" } } })).not.toThrow();
	expect(() => validateKoreInputMessage({ command: KoreInputCommand.PointerDown, payload: { x: Number.NaN, y: 20 } })).toThrow("finite");
	expect(() => validateKoreInputMessage({ command: "unknown", payload: {} })).toThrow("Unknown KORE input command");
});
