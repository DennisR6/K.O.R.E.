import { describe, expect, test } from "bun:test";
import { createKoreMainMenuSurface, type KoreMainMenuSurface } from "../src/kore/ui/KoreMainMenuSurface.ts";
import { MAP_CATALOG } from "../src/content/mapCatalog.js";

const firstMapId = MAP_CATALOG.find(entry => entry.browserAvailable)!.id;
// First map row at world (150..650, 80..120).
const MAP_ROW = { x: 400, y: 100 };
// Back sits below the rows: local mode shows 6 rows (y 388..422), battle
// mode shows only the battleAvailable rows (5 -> y 338..372).
const LOCAL_BACK = { x: 210, y: 405 };
const BATTLE_BACK = { x: 210, y: 355 };

function pressAt(menu: KoreMainMenuSurface, x: number, y: number): void {
	menu.updateMouse(x, y);
	menu.handleMousePressed();
}

function menuWithCallbacks(recorder: { local: string[]; battle: string[]; online: number }) {
	return createKoreMainMenuSurface({ onPlayLocal: () => { recorder.local.push("immediate"); }, onSelectMap: (mapId: string) => { recorder.local.push(mapId); }, onPlayOnline: () => { recorder.online++; }, onPlayAiBattle: (mapId: string) => { recorder.battle.push(mapId); } });
}

describe("main menu KI vs KI battle map selection", () => {
	test("routes the KI vs KI button through the map page to the battle callback", () => {
		const recorder = { local: [] as string[], battle: [] as string[], online: 0 };
		const menu = menuWithCallbacks(recorder);
		pressAt(menu, 400, 100); // landing page -> main menu page
		// KI vs KI at world (270..530, 176..234) opens the map page.
		pressAt(menu, 249, 143);
		expect(recorder.battle).toEqual([]);
		// The first map row starts the battle on the chosen map.
		pressAt(menu, MAP_ROW.x, MAP_ROW.y);
		expect(recorder.battle).toEqual([firstMapId]);
		expect(recorder.local).toEqual([]);
		expect(recorder.online).toBe(0);
	});

	test("routes the Choose Map button to the local match callback", () => {
		const recorder = { local: [] as string[], battle: [] as string[], online: 0 };
		const menu = menuWithCallbacks(recorder);
		pressAt(menu, 400, 100); // landing page -> main menu page
		// Choose Map at world (270..530, 368..426).
		pressAt(menu, 701, 143);
		pressAt(menu, MAP_ROW.x, MAP_ROW.y);
		expect(recorder.local).toEqual([firstMapId]);
		expect(recorder.battle).toEqual([]);
	});

	test("Back from the map page clears a pending battle and returns to the menu", () => {
		const recorder = { local: [] as string[], battle: [] as string[], online: 0 };
		const menu = menuWithCallbacks(recorder);
		pressAt(menu, 400, 100); // landing page -> main menu page
		pressAt(menu, 249, 143); // KI vs KI opens the map page (pending battle)
		pressAt(menu, BATTLE_BACK.x, BATTLE_BACK.y); // Back -> main menu, pending intent cleared
		pressAt(menu, 701, 143); // Choose Map now opens the map page (pending local)
		pressAt(menu, MAP_ROW.x, MAP_ROW.y);
		expect(recorder.local).toEqual([firstMapId]);
		expect(recorder.battle).toEqual([]);
	});

	test("battle mode shows only maps whose AI battle terminates", () => {
		const recorder = { local: [] as string[], battle: [] as string[], online: 0 };
		const menu = menuWithCallbacks(recorder);
		pressAt(menu, 400, 100); // landing page -> main menu page
		const battleMaps = MAP_CATALOG.filter(entry => entry.browserAvailable && entry.battleAvailable);
		// Rows are packed from the top; re-enter battle mode for every row
		// because the page stays active after a selection in this unit setup.
		const picked: string[] = [];
		for (let index = 0; index < battleMaps.length; index++) {
		pressAt(menu, 249, 143); // KI vs KI (battle mode)
			pressAt(menu, 400, 100 + index * 50);
			picked.push(recorder.battle[recorder.battle.length - 1]!);
			pressAt(menu, BATTLE_BACK.x, BATTLE_BACK.y); // back to the menu
		}
		expect(picked).toEqual(battleMaps.map(entry => entry.id));
		expect(recorder.local).toEqual([]);
		// Non-terminating maps (e.g. symmetric-duel) stay selectable for
		// human local play on the local path.
		pressAt(menu, 400, 100); // landing -> menu
		pressAt(menu, 701, 143); // Choose Map (local mode, all 6 rows)
		pressAt(menu, 400, 100); // first row: ice-map-v1
		expect(recorder.local).toEqual(["ice-map-v1"]);
	});

	test("does not fire any action for presses outside the buttons", () => {
		const recorder = { local: [] as string[], battle: [] as string[], online: 0 };
		const menu = menuWithCallbacks(recorder);
		pressAt(menu, 400, 100); // landing page -> main menu page
		pressAt(menu, 100, 205); // left of the button column
		pressAt(menu, 400, 237); // gap between the KI and online buttons
		pressAt(menu, 400, 300); // gap between the online and play buttons
		expect(recorder.local).toEqual([]);
		expect(recorder.battle).toEqual([]);
		expect(recorder.online).toBe(0);
	});

	test("is a no-op when no callbacks are configured", () => {
		const menu = createKoreMainMenuSurface();
		pressAt(menu, 400, 100); // landing page -> main menu page
		pressAt(menu, 249, 143); // KI vs KI opens the map page
		pressAt(menu, MAP_ROW.x, MAP_ROW.y); // no battle callback
		pressAt(menu, BATTLE_BACK.x, BATTLE_BACK.y); // back to the menu
		// No throw and no navigation stub: the presses are simply ignored.
		expect(menu).toBeDefined();
	});
});
