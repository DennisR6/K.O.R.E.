import { afterAll, describe, expect, test } from "@playwright/test";
import { activeBrowserServers, assertCleanConsole, canvasGeometry, captureConsole, clickWorld, dragWorld, ensureBrowserBuild, launchBrowser, closeBrowser, openPage, readMatchState, startTestServer, waitFor } from "./browserHarness.ts";

test.describe("browser audio aggregation pilots", () => {
	test.afterAll(() => expect(activeBrowserServers()).toBe(0));
	test("menu and local gameplay submit semantic music and UI/gameplay cues through the one browser manager", async () => {
		await ensureBrowserBuild(); const server = await startTestServer(); const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url); const capture = captureConsole(page);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");
			await waitFor(async () => await page.evaluate(() => (window as any).game.audio.getAppliedCommands().some((command: any) => command.soundId === "kore.music.menu")), 10_000, 100, "menu music request");
			await clickWorld(page, 400, 100); await clickWorld(page, 463, 368);
			await waitFor(async () => (await page.evaluate(() => (window as any).game?.handler?.getSettings?.()?.gameMode?.id)) === "local-ice-duel-v1", 10_000, 100, "local game");
			await waitFor(async () => await page.evaluate(() => (window as any).game.audio.getAppliedCommands().some((command: any) => command.soundId === "kore.music.match")), 10_000, 100, "match music request");
			const soundIds = await page.evaluate(() => (window as any).game.audio.getAppliedCommands().map((command: any) => command.soundId));
			expect(soundIds).toContain("kore.music.menu");
			expect(soundIds).toContain("kore.ui.confirm");
			expect(soundIds).toContain("kore.music.match");
			await clickWorld(page, 660, 327); // item phase -> physics
			await waitFor(async () => (await readMatchState(page)).phase === "physics", 5_000, 50, "physics phase");
			const state = await readMatchState(page); const actor = state.entities.find((entity: any) => !entity.dead && entity.team.includes(state.activeTeam))!;
			await dragWorld(page, { x: actor.x, y: actor.y }, { x: actor.x + 40, y: actor.y - 20 });
			await waitFor(async () => await page.evaluate(() => (window as any).game.audio.getAppliedCommands().some((command: any) => command.soundId === "kore.game.shot")), 5_000, 50, "shot sound request");
			assertCleanConsole(capture);
		} finally { await closeBrowser(browser); await server.stop(); }
		expect(activeBrowserServers()).toBe(0);
	});
});
