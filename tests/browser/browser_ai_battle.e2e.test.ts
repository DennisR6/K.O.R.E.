import { describe, expect, test, afterAll } from "@playwright/test";
import {
	activeBrowserServers,
	activeGameModeId,
	assertCleanConsole,
	captureConsole,
	canvasGeometry,
	clickWorld,
	ensureBrowserBuild,
	finiteEntities,
	launchBrowser,
	closeBrowser,
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
test.describe("browser KI vs KI battle", () => {
	test.afterAll(() => {
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
			expect(menuHandler).toBe("KoreMainMenuSurface");
			expect(await page.evaluate(() => (window as any).game?.handler?.getSettings?.()?.gameMode?.id ?? null)).toBeNull();

			// Landing page -> main menu -> "KI vs KI" in the centered bottom action row
			// opens the Choose Map page; the first row (Ice Map) starts the battle.
			await clickWorld(page, 400, 100);
			await clickWorld(page, 249, 368);
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
			// Autonomous battles retain only the passive AI driver until the result overlay.
			expect(matchInfo.mouseHandler).toBe("AiBattleSystem");
			expect(matchInfo.gameplayInput).toBeNull();
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
			await closeBrowser(browser);
			await server.stop();
		}
		expect(server.isAlive()).toBe(false);
		expect(activeBrowserServers()).toBe(0);
	});

test("autonomous AI battle progresses without a player pause surface", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");
			await clickWorld(page, 400, 100);
			await clickWorld(page, 249, 368);
			await clickWorld(page, 400, 100);
			await waitFor(async () => (await activeGameModeId(page)) === "local-ice-duel-v1", 10_000, 100, "KI vs KI battle start");
			await waitFor(async () => (await readMatchState(page)).state === "GameState.Playing", 60_000, 100, "active AI playback");

			const beforeState = await readMatchState(page);
			expect(beforeState.paused).toBe(false);
			await clickWorld(page, 748, 25);
			await clickWorld(page, 400, 261);
			expect((await readMatchState(page)).paused).toBe(false);
			await waitFor(async () => (await readMatchState(page)).turnNumber > beforeState.turnNumber, 60_000, 100, "AI battle progression");
		} finally {
			await closeBrowser(browser);
			await server.stop();
		}
		expect(server.isAlive()).toBe(false);
		expect(activeBrowserServers()).toBe(0);
});

test("production Hard AI worker overlaps playback without blocking the event loop", async () => {
	await ensureBrowserBuild();
	const server = await startTestServer();
	const browser = await launchBrowser();
	try {
		const page = await openPage(browser, server.url);
		await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");
		await clickWorld(page, 400, 100);
		await clickWorld(page, 249, 368);
		await clickWorld(page, 400, 100);
		await waitFor(async () => (await activeGameModeId(page)) === "local-ice-duel-v1", 10_000, 100, "KI vs KI battle start");
		await page.evaluate(() => {
			const target = window as any;
			target.__aiLongTasks = [];
			if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("longtask")) {
				const observer = new PerformanceObserver(list => target.__aiLongTasks.push(...list.getEntries().map((entry: PerformanceEntry) => ({ duration: entry.duration, name: entry.name }))));
				observer.observe({ type: "longtask", buffered: true });
				target.__aiLongTaskObserver = observer;
			}
		});
		await waitFor(async () => await page.evaluate(() => {
			const metrics = (window as any).game?.aiWorkerMetrics;
			return (metrics?.requestCount ?? 0) >= 3 && (metrics?.validResponseCount ?? 0) >= 3;
		}), 180_000, 100, "three validated production worker responses");
		const metrics = await page.evaluate(() => (window as any).game?.aiWorkerMetrics ?? null);
		const longTasks = await page.evaluate(() => { const target = window as any; target.__aiLongTaskObserver?.disconnect(); return target.__aiLongTasks ?? []; });
		const performanceLogs = await page.evaluate(() => {
			const handler = (window as any).game.handler;
			return handler.getLogs(handler.LoggerType.Performance).map((log: any) => ({ type: log.type, data: log.data }));
		});
		if (process.env.AI_DIAGNOSTIC === "1") console.log("production worker metrics", metrics);
		if (process.env.AI_DIAGNOSTIC === "1") console.log("production worker rejections", performanceLogs.filter((log: { type: string }) => log.type === "ai.worker.rejected"));
		expect(metrics?.workerPathAvailable).toBe(true);
		expect(metrics?.requestCount).toBeGreaterThan(0);
		expect(metrics?.validResponseCount).toBeGreaterThan(0);
		expect(Number.isFinite(metrics?.workerComputeMs)).toBe(true);
		expect(Number.isFinite(metrics?.playerVisibleDurationMs)).toBe(true);
		expect(Number.isFinite(metrics?.precomputeHeadroomMs)).toBe(true);
		expect(Number.isFinite(metrics?.postTurnWaitMs)).toBe(true);
		expect(metrics?.maxEventLoopGapMs).toBeLessThan(500);
		expect(performanceLogs.map((log: { type: string }) => log.type)).toContain("ai.worker.requested");
		expect(performanceLogs.filter((log: { type: string; data?: { maxTicks?: number } }) => log.type === "turn.simulation.max-ticks" && log.data?.maxTicks === 1200)).toHaveLength(0);
		expect(performanceLogs.filter((log: { type: string }) => log.type === "ai.worker.completed").length).toBeGreaterThan(0);
		expect(performanceLogs.find((log: { type: string; data?: unknown }) => log.type === "ai.worker.completed")?.data).toHaveProperty("precomputeHeadroomMs");
		expect(performanceLogs.map((log: { type: string }) => log.type)).toContain("turn.playback.completed");
		if (process.env.AI_DIAGNOSTIC === "1") console.log("production long tasks", longTasks);
	} finally {
		await closeBrowser(browser);
		await server.stop();
	}
	expect(server.isAlive()).toBe(false);
});

test("autonomous AI battle ignores menu coordinates while it is running", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");
			await clickWorld(page, 400, 100);
			await clickWorld(page, 249, 368);
			await clickWorld(page, 400, 100);
			await waitFor(async () => (await activeGameModeId(page)) === "local-ice-duel-v1", 10_000, 100, "KI vs KI battle start");
			await waitFor(async () => (await readMatchState(page)).state === "GameState.Playing", 60_000, 100, "active AI playback");
			await clickWorld(page, 748, 25);
			await clickWorld(page, 482, 324);
			expect((await readMatchState(page)).paused).toBe(false);
			expect(await activeGameModeId(page)).toBe("local-ice-duel-v1");
			expect(await page.evaluate(() => (window as any).game?.mapId ?? null)).toBe("ice-map-v1");
		} finally {
			await closeBrowser(browser);
			await server.stop();
		}
		expect(server.isAlive()).toBe(false);
		expect(activeBrowserServers()).toBe(0);
	});

	test("starts a human 1-vs-KI match after difficulty and map selection", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");
			await clickWorld(page, 400, 100); // landing -> main menu
		await clickWorld(page, 99, 368); // 1 vs KI
			await clickWorld(page, 400, 214); // Medium KI
			await clickWorld(page, 400, 100); // Ice Map
			await waitFor(async () => (await page.evaluate(() => (window as any).game?.handler?.getSettings?.()?.ai?.difficulty ?? null)) === "medium", 10_000, 100, "human-vs-KI start");
			expect(await page.evaluate(() => (window as any).game?.mapId ?? null)).toBe("ice-map-v1");
		expect(await page.evaluate(() => (window as any).game?.handler?.getTeam?.() ?? null)).toEqual([0]);
		} finally {
			await closeBrowser(browser);
			await server.stop();
		}
		expect(server.isAlive()).toBe(false);
	});
});
