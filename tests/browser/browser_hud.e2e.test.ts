import { afterAll, describe, expect, test } from "@playwright/test";
import { activeBrowserServers, assertCleanConsole, canvasGeometry, captureConsole, clickWorld, ensureBrowserBuild, launchBrowser, closeBrowser, openPage, readMatchState, startTestServer, waitFor } from "./browserHarness.ts";

test.describe("SDK-authored gameplay HUD", () => {
	test.afterAll(() => expect(activeBrowserServers()).toBe(0));
	test("local match uses the HUD surface for projected turn status and item-phase commands", async () => {
		await ensureBrowserBuild(); const server = await startTestServer(); const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url); const capture = captureConsole(page);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "canvas");
			await clickWorld(page, 400, 100); await clickWorld(page, 400, 325);
			await waitFor(async () => (await page.evaluate(() => (window as any).game.handler.getMouseHandler().constructor.name)) === "KoreGameHudSurface", 10_000, 100, "HUD surface");
			const hud = await page.evaluate(() => {
				const value = (window as any).game.handler.getMouseHandler();
				return { id: value.getRuntime().toSettings().id, turn: value.getRuntime().toSettings().screens[0].elements.find((element: any) => element.id === "hud-turn").text };
			});
			expect(hud.id).toBe("kore.game-hud.ui"); expect(hud.turn).toContain("Turn 1");
			await clickWorld(page, 660, 327);
			await waitFor(async () => (await readMatchState(page)).phase === "physics", 5_000, 50, "HUD skip item phase");
			assertCleanConsole(capture);
		} finally { await closeBrowser(browser); await server.stop(); }
		expect(activeBrowserServers()).toBe(0);
	});
});
