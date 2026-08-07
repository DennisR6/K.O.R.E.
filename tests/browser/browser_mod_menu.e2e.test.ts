import { expect, test } from "@playwright/test";
import { activeBrowserServers, assertCleanConsole, canvasGeometry, captureConsole, clickWorld, ensureBrowserBuild, launchBrowser, closeBrowser, openPage, startTestServer, waitFor } from "./browserHarness.ts";

const MOD_TEXT = JSON.stringify({
	schemaVersion: 1,
	manifest: { id: "browser-mod", name: "Browser Mod", version: "1.0.0" },
	maps: [{
		schemaVersion: 1,
		metadata: { id: "browser-map", name: "Browser Map" },
		worldSize: { x: 800, y: 450 },
		friction: { friction: 0.02, linearDrag: 0.004, stopThreshold: 0.02 },
		drift: 0,
		arenaGeometry: [{ type: 2, x: 0, y: 0, w: 800, h: 450, role: "containment", effects: [] }],
		spawnRegions: [
			{ team: 0, x: 40, y: 150, w: 120, h: 140 },
			{ team: 1, x: 640, y: 150, w: 120, h: 140 },
		],
		hazards: [],
	}],
	items: [{
		schemaVersion: 1,
		id: "browser-item",
		name: "Browser Item",
		type: "defensive",
		effects: [{ type: "shield", value: { capacity: 10 } }],
		targetType: "self",
		duration: { type: "turns", value: 1 },
		useLimit: { perTurn: 1, perGame: 1 },
	}],
	modes: [{
		schemaVersion: 1,
		id: "browser-mode",
		phases: ["item", "aim", "charge", "push", "physics"],
		maxItemsPerTurn: 1,
		winCondition: "last-team-standing",
		itemEconomy: { fixedLoadouts: [], mapPickups: [] },
	}],
});

test.describe("browser mod menu flow", () => {
	test.afterAll(() => expect(activeBrowserServers()).toBe(0));
	test("imports through the production surface and launches package content", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			const capture = captureConsole(page);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "menu canvas");
			await clickWorld(page, 400, 100);
			await clickWorld(page, 715, 368); // Mods
			await page.evaluate((text: string) => {
				const surface = (window as any).game.handler.getMouseHandler();
				surface.importModText(text, { kind: "paste" });
			}, MOD_TEXT);
			expect(await page.evaluate(() => (window as any).game.handler.getMouseHandler().getRuntime().getActiveScreen())).toBe("mod-result");
			await clickWorld(page, 260, 266); // Test 1 vs AI
			await waitFor(async () => (await page.evaluate(() => (window as any).game.handler.getSettings?.()?.gameMode?.id)) === "browser-mode", 10_000, 100, "mod match handoff");
			const settings = await page.evaluate(() => {
				const value = (window as any).game.handler.getSettings();
				return { mapId: (window as any).game.mapId, items: value.items?.map((item: any) => item.id), world: value.worldSize };
			});
			expect(settings).toEqual({ mapId: "browser-map", items: ["browser-item"], world: { x: 800, y: 450 } });
			assertCleanConsole(capture);
		} finally {
			await closeBrowser(browser);
			await server.stop();
		}
		expect(activeBrowserServers()).toBe(0);
	});
});
