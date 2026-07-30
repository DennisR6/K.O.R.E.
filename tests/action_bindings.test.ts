import { expect, test } from "bun:test";
import { ActionManager, GameAction, createDefaultActionBindings } from "../src/input/actions.ts";

test("default action bindings cover aim, charge, push, and itemUse", () => {
	const defaults = createDefaultActionBindings();
	expect(defaults.schemaVersion).toBe(1);
	expect(defaults.bindings[GameAction.Aim].keys).toContain("KeyA");
	expect(defaults.bindings[GameAction.Charge].keys).toContain("Space");
	expect(defaults.bindings[GameAction.Push].keys).toContain("Enter");
	expect(defaults.bindings[GameAction.ItemUse].keys).toContain("KeyI");
});

test("ActionManager allows custom rebinding and lookup", () => {
	const manager = new ActionManager();
	expect(manager.getActionForKey("KeyS")).toBeUndefined();

	manager.bind(GameAction.Charge, { keys: ["KeyS"] });
	expect(manager.getActionForKey("KeyS")).toBe(GameAction.Charge);
	expect(manager.getActionForKey("Space")).toBeUndefined();

	expect(manager.getActionForMouseButton(0)).toBe(GameAction.Aim);
	manager.bind(GameAction.Aim, { mouseButtons: [1] });
	expect(manager.getActionForMouseButton(0)).toBeUndefined();
	expect(manager.getActionForMouseButton(1)).toBe(GameAction.Aim);
});

test("ActionManager configuration serializes and restores successfully", () => {
	const manager = new ActionManager({
		bindings: {
			[GameAction.Aim]: { keys: ["KeyQ"] },
			[GameAction.Charge]: { keys: ["KeyE"] },
			[GameAction.Push]: { keys: ["KeyR"] },
			[GameAction.ItemUse]: { keys: ["KeyF"] },
		},
	});

	const config = manager.getConfig();
	const restored = new ActionManager(config);
	expect(restored.getConfig()).toEqual(config);
	expect(restored.getActionForKey("KeyQ")).toBe(GameAction.Aim);
	expect(restored.getActionForKey("KeyF")).toBe(GameAction.ItemUse);
});
