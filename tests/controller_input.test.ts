import { test, expect, describe } from "bun:test";
import { ActionManager, GameAction } from "../src/input/actions.js";
import { ControllerInput } from "../src/input/controller.js";

describe("ControllerInput", () => {
	test("detects pressed gamepad buttons based on action bindings", () => {
		const actionManager = new ActionManager();
		const mockGamepad = {
			index: 0,
			id: "Mock Controller",
			connected: true,
			timestamp: 100,
			mapping: "standard" as GamepadMappingType,
			axes: [0, 0, 0, 0],
			buttons: [
				{ pressed: true, touched: true, value: 1.0 }, // button 0 (Charge default)
				{ pressed: false, touched: false, value: 0 }, // button 1
				{ pressed: false, touched: false, value: 0 },
			],
		} as unknown as Gamepad;

		const controller = new ControllerInput(actionManager, {
			getGamepads: () => [mockGamepad],
		});

		expect(controller.isActionPressed(GameAction.Charge)).toBe(true);
		expect(controller.isActionPressed(GameAction.Push)).toBe(false);

		// Rebind push to button 0
		actionManager.bind(GameAction.Push, { gamepadButtons: [0] });
		expect(controller.isActionPressed(GameAction.Push)).toBe(true);
	});

	test("gamepad access failures are isolated from gameplay", () => {
	const controller = new ControllerInput(new ActionManager(), { getGamepads: () => { throw new Error("permission denied"); } });
	expect(controller.getActiveGamepad()).toBeNull();
	expect(controller.getAimVector()).toEqual({ x: 0, y: 0 });
});

	test("calculates aim vector from axes with deadzone", () => {
		const actionManager = new ActionManager();
		const mockGamepad = {
			index: 0,
			id: "Mock Controller",
			connected: true,
			timestamp: 100,
			mapping: "standard" as GamepadMappingType,
			axes: [0.8, -0.5, 0.05, 0], // axis 0 = 0.8, axis 1 = -0.5, axis 2 = 0.05 (below deadzone)
			buttons: [],
		} as unknown as Gamepad;

		const controller = new ControllerInput(actionManager, {
			deadzone: 0.1,
			getGamepads: () => [mockGamepad],
		});

		const aim = controller.getAimVector();
		expect(aim.x).toBe(0.8);
		expect(aim.y).toBe(-0.5);

		// Test deadzone
		const mockGamepadSmall = {
			index: 0,
			id: "Mock Controller",
			connected: true,
			timestamp: 100,
			mapping: "standard" as GamepadMappingType,
			axes: [0.05, 0.02, 0, 0],
			buttons: [],
		} as unknown as Gamepad;

		const controllerDeadzone = new ControllerInput(actionManager, {
			deadzone: 0.1,
			getGamepads: () => [mockGamepadSmall],
		});

		const aimZero = controllerDeadzone.getAimVector();
		expect(aimZero.x).toBe(0);
		expect(aimZero.y).toBe(0);
	});

	test("calculates charge pressure from triggers and axes", () => {
		const actionManager = new ActionManager();
		const mockGamepad = {
			index: 0,
			id: "Mock Controller",
			connected: true,
			timestamp: 100,
			mapping: "standard" as GamepadMappingType,
			axes: [0, 0, 0, 0.5],
			buttons: [
				{ pressed: false, touched: false, value: 0 },
				{ pressed: false, touched: false, value: 0 },
				{ pressed: false, touched: false, value: 0 },
				{ pressed: false, touched: false, value: 0 },
				{ pressed: false, touched: false, value: 0 },
				{ pressed: false, touched: false, value: 0 },
				{ pressed: false, touched: false, value: 0 },
				{ pressed: true, touched: true, value: 0.75 }, // button 7 (right trigger)
			],
		} as unknown as Gamepad;

		const controller = new ControllerInput(actionManager, {
			getGamepads: () => [mockGamepad],
		});

		expect(controller.getChargePressure()).toBe(0.75);
	});
});
