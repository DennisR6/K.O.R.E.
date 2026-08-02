import { describe, expect, test } from "bun:test";
import { MainMenu } from "../src/menu/Menu.js";

function pressAt(menu: MainMenu, x: number, y: number): void {
	menu.updateMouse(x, y);
	menu.handleMousePressed();
}

describe("main menu KI vs KI battle button", () => {
	test("routes the KI vs KI button to the configured callback", () => {
		let battles = 0;
		let online = 0;
		let local = 0;
		const menu = new MainMenu(
			() => { local++; },
			() => { },
			undefined,
			() => { online++; },
			() => { battles++; },
		);
		// Landing page: any press advances to the main menu page.
		pressAt(menu, 400, 100);
		// KI vs KI at world (270..530, 176..234).
		pressAt(menu, 400, 205);
		expect(battles).toBe(1);
		expect(online).toBe(0);
		expect(local).toBe(0);
	});

	test("does not fire the battle action for presses outside the button", () => {
		let battles = 0;
		const menu = new MainMenu(undefined, undefined, undefined, undefined, () => { battles++; });
		pressAt(menu, 400, 100); // landing page -> main menu page
		pressAt(menu, 100, 205); // left of the button column
		pressAt(menu, 400, 237); // gap between the KI and online buttons
		expect(battles).toBe(0);
	});

	test("keeps the other main menu actions on their rectangles", () => {
		let battles = 0;
		let online = 0;
		let local = 0;
		const menu = new MainMenu(
			() => { local++; },
			() => { },
			undefined,
			() => { online++; },
			() => { battles++; },
		);
		pressAt(menu, 400, 100); // landing page -> main menu page
		// Play Online at world (270..530, 240..298).
		pressAt(menu, 400, 250);
		// Play Local Game at world (270..530, 304..362).
		pressAt(menu, 400, 325);
		expect(battles).toBe(0);
		expect(online).toBe(1);
		expect(local).toBe(1);
	});

	test("is a no-op when no battle callback is configured", () => {
		const menu = new MainMenu();
		pressAt(menu, 400, 100); // landing page -> main menu page
		pressAt(menu, 400, 205); // KI vs KI without a callback
		// No throw and no navigation stub: the press is simply ignored.
		expect(menu).toBeDefined();
	});
});
