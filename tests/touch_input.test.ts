import { test, expect, describe } from "bun:test";
import { ActionManager } from "../src/input/actions.js";
import { TouchInputHandler } from "../src/input/touch.js";
import { UiSystem } from "../src/systems/UiSystem.js";

describe("TouchInputHandler", () => {
	test("handles touch start, move, and end lifecycle correctly", () => {
		const actionManager = new ActionManager();
		const uiSystem = new UiSystem();
		const touchHandler = new TouchInputHandler(actionManager, uiSystem);

		expect(touchHandler.isTouchActive()).toBe(false);

		const touchStartEvent = {
			changedTouches: [
				{ identifier: 1, clientX: 100, clientY: 200 }
			]
		};

		const rect = { left: 10, top: 20, width: 400, height: 300, right: 410, bottom: 320, toJSON: () => {} };

		touchHandler.handleTouchStart(touchStartEvent, rect);
		expect(touchHandler.isTouchActive()).toBe(true);
		expect(uiSystem.currentMouse).toEqual({ x: 90, y: 180 });
		expect(uiSystem.start).toEqual({ x: 90, y: 180 });

		const touchMoveEvent = {
			changedTouches: [
				{ identifier: 1, clientX: 150, clientY: 250 }
			]
		};

		touchHandler.handleTouchMove(touchMoveEvent, rect);
		expect(uiSystem.currentMouse).toEqual({ x: 140, y: 230 });

		const touchEndEvent = {
			changedTouches: [
				{ identifier: 1, clientX: 150, clientY: 250 }
			]
		};

		touchHandler.handleTouchEnd(touchEndEvent, rect);
		expect(touchHandler.isTouchActive()).toBe(false);
		expect(uiSystem.end).toEqual({ x: 140, y: 230 });
	});

	test("handles touch cancel", () => {
		const actionManager = new ActionManager();
		const uiSystem = new UiSystem();
		const touchHandler = new TouchInputHandler(actionManager, uiSystem);

		const touchStartEvent = {
			changedTouches: [
				{ identifier: 2, clientX: 50, clientY: 50 }
			]
		};

		touchHandler.handleTouchStart(touchStartEvent);
		expect(touchHandler.isTouchActive()).toBe(true);

		const touchCancelEvent = {
			changedTouches: [
				{ identifier: 2, clientX: 50, clientY: 50 }
			]
		};

		touchHandler.handleTouchCancel(touchCancelEvent);
		expect(touchHandler.isTouchActive()).toBe(false);
	});
});
