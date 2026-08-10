import { describe, expect, test } from "bun:test";
import { createKoreMainMenuSurface, type KoreMainMenuSurface } from "../src/kore/ui/KoreMainMenuSurface.ts";

function pressAt(menu: KoreMainMenuSurface, x: number, y: number): void {
	menu.updateMouse(x, y);
	menu.handleMousePressed();
}

describe("main menu online join", () => {
	test("routes Play Online through the configured map selection callback", () => {
		let online = 0;
		let local = 0;
		let map = 0;
		const menu = createKoreMainMenuSurface({ onPlayLocal: () => { local++; }, onSelectMap: () => { map++; }, onPlayOnline: () => { online++; } });
		// Landing page: any press advances to the main menu page.
		pressAt(menu, 400, 100);
		// Play Online opens the online map-preference screen.
		pressAt(menu, 337, 368);
		pressAt(menu, 400, 100);
		expect(online).toBe(1);
		expect(local).toBe(0);
		expect(map).toBe(0);
	});

	test("keeps the existing buttons on their documented rectangles", () => {
		let online = 0;
		let local = 0;
		let map = 0;
		const menu = createKoreMainMenuSurface({ onPlayLocal: () => { local++; }, onSelectMap: (_mapId: string) => { map++; }, onPlayOnline: () => { online++; } });
		pressAt(menu, 400, 100); // landing page -> main menu page
		// Play Local Game is the fourth button in the centered bottom action row.
		pressAt(menu, 463, 368);
		expect(local).toBe(1);
		// Choose Map is the fifth button in the centered bottom action row -> map selection page,
		// where the first map row sits at world (150..650, 80..120).
		pressAt(menu, 589, 368);
		pressAt(menu, 400, 100);
		expect(map).toBe(1);
		expect(online).toBe(0);
	});

	test("does not fire the online action for presses outside the button", () => {
		let online = 0;
		const menu = createKoreMainMenuSurface({ onPlayOnline: () => { online++; } });
		pressAt(menu, 400, 100); // landing page -> main menu page
		pressAt(menu, 100, 250); // left of the button column
		pressAt(menu, 400, 300); // gap between the online and play buttons
		expect(online).toBe(0);
	});
});
