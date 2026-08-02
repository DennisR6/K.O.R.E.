import { describe, expect, test } from "bun:test";
import { MainMenu } from "../src/menu/Menu.js";

function pressAt(menu: MainMenu, x: number, y: number): void {
	menu.updateMouse(x, y);
	menu.handleMousePressed();
}

describe("main menu online join", () => {
	test("routes the Play Online button to the configured callback", () => {
		let online = 0;
		let local = 0;
		let map = 0;
		const menu = new MainMenu(
			() => { local++; },
			() => { map++; },
			undefined,
			() => { online++; },
		);
		// Landing page: any press advances to the main menu page.
		pressAt(menu, 400, 100);
		// Play Online at world (270..530, 240..298).
		pressAt(menu, 400, 250);
		expect(online).toBe(1);
		expect(local).toBe(0);
		expect(map).toBe(0);
	});

	test("keeps the existing buttons on their documented rectangles", () => {
		let online = 0;
		let local = 0;
		let map = 0;
		const menu = new MainMenu(
			() => { local++; },
			(_mapId: string) => { map++; },
			undefined,
			() => { online++; },
		);
		pressAt(menu, 400, 100); // landing page -> main menu page
		// Play Local Game at world (270..530, 304..362).
		pressAt(menu, 400, 325);
		expect(local).toBe(1);
		// Choose Map at world (270..530, 368..426) -> map selection page,
		// where the first map row sits at world (150..650, 80..120).
		pressAt(menu, 400, 409);
		pressAt(menu, 400, 100);
		expect(map).toBe(1);
		expect(online).toBe(0);
	});

	test("does not fire the online action for presses outside the button", () => {
		let online = 0;
		const menu = new MainMenu(undefined, undefined, undefined, () => { online++; });
		pressAt(menu, 400, 100); // landing page -> main menu page
		pressAt(menu, 100, 250); // left of the button column
		pressAt(menu, 400, 300); // gap between the online and play buttons
		expect(online).toBe(0);
	});
});
