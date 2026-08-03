import { describe, expect, test, afterAll } from "bun:test";
import {
	activeBrowserServers,
	assertCleanConsole,
	captureConsole,
	canvasGeometry,
	clickWorld,
	ensureBrowserBuild,
	finiteEntities,
	launchBrowser,
	openPage,
	readMatchState,
	startTestServer,
	waitFor,
} from "./browserHarness.ts";

/**
 * KI-vs-KI battle browser verification.
 *
 * The menu's "KI vs KI" button must start an autonomous battle on the
 * canonical arena: the match boots through the production menu, both AI
 * teams take turns without any pointer input, and the authoritative handler
 * advances its turn counter while keeping every entity state finite.
 */
describe("browser KI vs KI battle", () => {
	afterAll(() => {
		expect(activeBrowserServers()).toBe(0);
	});

	test("starts an autonomous battle from the menu and plays turns without input", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			const capture = captureConsole(page);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");

			// Menu is active before the battle starts.
			const menuHandler = await page.evaluate(() => (window as any).game.handler.getMouseHandler?.()?.constructor?.name ?? null);
			expect(menuHandler).toBe("MainMenu");
			expect(await page.evaluate(() => (window as any).game?.handler?.getSettings?.()?.gameMode?.id ?? null)).toBeNull();

			// Landing page -> main menu -> "KI vs KI" at world (270..530, 176..234)
			// opens the Choose Map page; the first row (Ice Map) starts the battle.
			await clickWorld(page, 400, 100);
			await clickWorld(page, 400, 205);
			await clickWorld(page, 400, 100);

			// The battle handler boots the canonical arena.
			await waitFor(
				async () => (await page.evaluate(() => (window as any).game?.handler?.getSettings?.()?.gameMode?.id ?? null)) === "local-ice-duel-v1",
				10_000,
				100,
				"KI vs KI battle start",
			);
			// The selected map is the one that was picked on the map page.
			expect(await page.evaluate(() => (window as any).game?.mapId ?? null)).toBe("ice-map-v1");
			const matchInfo = await page.evaluate(() => {
				const handler = (window as any).game.handler;
				const overlay = handler?.getMouseHandler?.();
				return {
					mouseHandler: overlay?.constructor?.name ?? null,
					gameplayInput: overlay?.getGameplayInput?.()?.constructor?.name ?? null,
					entities: handler?.getEntityManager?.()?.getEntities?.()?.length ?? 0,
				};
			});
			// The battle routes pointer events through the result overlay, whose
			// wrapped gameplay input is the passive AI driver (no human input).
			expect(matchInfo.mouseHandler).toBe("MatchResultOverlay");
			expect(matchInfo.gameplayInput).toBe("AiBattleSystem");
			expect(matchInfo.entities).toBe(12);

			// The battle plays without any pointer input: wait until at least
			// one full turn completed (turn counter advanced past zero).
			await waitFor(async () => (await readMatchState(page)).turnNumber >= 1, 60_000, 250, "first completed battle turn");

			// Entity states must stay finite while the battle keeps running.
			const state = await readMatchState(page);
			expect(finiteEntities(state)).toBe(true);
			expect(Number.isFinite(state.playbackFrames)).toBe(true);

			assertCleanConsole(capture);
		} finally {
			await browser.close();
			await server.stop();
		}
		expect(server.isAlive()).toBe(false);
		expect(activeBrowserServers()).toBe(0);
	}, 120_000);
});
