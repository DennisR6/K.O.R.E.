import { test, expect, describe } from "bun:test";
import { UiSystem } from "../src/systems/UiSystem.js";

describe("Stabilize Canvas Input Handlers", () => {
	test("UiSystem handles wheel events without error", () => {
		const ui = new UiSystem();
		const wheelEvent = { deltaY: 50 } as WheelEvent;
		expect(() => ui.handleMouseWheel(wheelEvent)).not.toThrow();
	});

	test("UiSystem tracks mouse press and release correctly", () => {
		const ui = new UiSystem();
		ui.updateMouse(200, 300);
		ui.handleMousePressed();
		expect(ui.start).toEqual({ x: 200, y: 300 });

		ui.updateMouse(250, 350);
		ui.handleMouseReleased();
		expect(ui.end).toEqual({ x: 250, y: 350 });
	});
});
