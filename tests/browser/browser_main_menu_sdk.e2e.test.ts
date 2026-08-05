import { afterAll, describe, expect, test } from "@playwright/test";
import { activeBrowserServers, assertCleanConsole, canvasGeometry, captureConsole, clickWorld, ensureBrowserBuild, launchBrowser, closeBrowser, openPage, startTestServer, waitFor } from "./browserHarness.ts";

test.describe("SDK-authored production main menu", () => {
	test.afterAll(() => expect(activeBrowserServers()).toBe(0));
	test("builds the canonical menu, navigates through SDK screens, emits audio, and hands off to local play", async () => {
		await ensureBrowserBuild(); const server = await startTestServer(); const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url); const capture = captureConsole(page);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "menu canvas");
			const initial = await page.evaluate(() => {
				const menu = (window as any).game.handler.getMouseHandler();
				return { constructor: menu?.constructor?.name, id: menu?.getRuntime?.().toSettings?.().id, screen: menu?.getRuntime?.().getActiveScreen?.() };
			});
			expect(initial).toEqual({ constructor: "KoreMainMenuSurface", id: "kore.main-menu.ui", screen: "landing" });
			await waitFor(async () => await page.evaluate(() => (window as any).game.audio.getAppliedCommands().some((command: any) => command.soundId === "kore.music.menu")), 10_000, 100, "menu music request");

			await clickWorld(page, 400, 100); // landing -> main
			await clickWorld(page, 400, 205); // KI vs KI -> battle map screen
			expect(await page.evaluate(() => (window as any).game.handler.getMouseHandler().getRuntime().getActiveScreen())).toBe("map-battle");
			await clickWorld(page, 210, 355); // generic back action
			expect(await page.evaluate(() => (window as any).game.handler.getMouseHandler().getRuntime().getActiveScreen())).toBe("main");
			await clickWorld(page, 400, 325); // semantic local-game action -> router handoff
			await waitFor(async () => (await page.evaluate(() => (window as any).game.handler.getSettings?.()?.gameMode?.id)) === "local-ice-duel-v1", 10_000, 100, "local match handoff");
			await waitFor(async () => await page.evaluate(() => (window as any).game.audio.getAppliedCommands().some((command: any) => command.soundId === "kore.music.match")), 5_000, 50, "match music request");
			const commands = await page.evaluate(() => (window as any).game.audio.getAppliedCommands().map((command: any) => command.soundId));
			expect(commands.filter((id: string) => id === "kore.music.menu")).toHaveLength(1);
			expect(commands).toContain("kore.ui.confirm");
			expect(commands).toContain("kore.music.match");
			assertCleanConsole(capture);
		} finally { await closeBrowser(browser); await server.stop(); }
		expect(activeBrowserServers()).toBe(0);
	});
});
