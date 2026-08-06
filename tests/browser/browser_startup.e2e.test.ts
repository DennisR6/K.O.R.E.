import { describe, expect, test, afterAll } from "@playwright/test";
import type { Page } from "playwright";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	BrowserHarnessError,
	activeBrowserServers,
	assertCleanConsole,
	captureConsole,
	canvasGeometry,
	clickWorld,
	ensureBrowserBuild,
	launchBrowser,
	closeBrowser,
	nextTestPort,
	openPage,
	startTestServer,
	waitFor,
} from "./browserHarness.ts";

/**
 * Section 16.1: real browser test tooling and server harness.
 *
 * The harness must build the generated bundle, start the real Bun
 * HTTP/WebSocket server on an isolated test port, wait for readiness, and
 * always terminate the server after the test run. Every failure mode
 * (build error, server startup error, readiness timeout, browser launch
 * failure, leaked server process) must fail the harness with a typed error.
 */
test.describe("Section 16.1 browser harness", () => {
	test.afterAll(() => {
		// Every server started by this worker must be terminated.
		expect(activeBrowserServers()).toBe(0);
	});

	test("builds the game, starts the Bun server on an isolated port, waits for readiness, and terminates it", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		try {
			// Readiness: the real server answers the root URL.
			const response = await fetch(server.url);
			expect(response.status).toBe(200);
			expect(await response.text()).toContain("KORE");

			// The server uses an isolated test port and a temp database.
			expect(server.port).toBeGreaterThan(0);
			expect(server.port).not.toBe(3000);
			expect(existsSync(server.dbPath)).toBe(true);
		} finally {
			await server.stop();
		}

		// The server process is terminated and the port is free again.
		expect(server.isAlive()).toBe(false);
		expect(existsSync(server.dbPath)).toBe(false);
		await expect(fetch(server.url)).rejects.toThrow();
		expect(activeBrowserServers()).toBe(0);
	});

	test("fails on server startup error before readiness", async () => {
		// A regular file as the database parent makes GameDatabase throw
		// deterministically at startup (mkdir EEXIST), so the child exits
		// before it can ever listen on the port.
		const parentDir = mkdtempSync(join(tmpdir(), "kore-browser-block-"));
		const blocker = join(parentDir, "blocker-file");
		writeFileSync(blocker, "not a directory");
		const dbPath = join(blocker, "x.db");
		try {
			const port = nextTestPort();
			await expect(
				startTestServer({ port, dbPath, readinessTimeoutMs: 5_000 }),
			).rejects.toThrow(/server startup failed/);
			// Nothing was left behind.
			expect(activeBrowserServers()).toBe(0);
		} finally {
			rmSync(parentDir, { recursive: true, force: true });
		}
	});

	test("fails on readiness timeout and cleans up the child process", async () => {
		// A command that stays alive but never listens must time out, and the
		// harness must terminate the child and report the failure.
		const port = nextTestPort();
		await expect(
			startTestServer({
				port,
				readinessTimeoutMs: 500,
				pollIntervalMs: 50,
				command: ["bun", "-e", "setInterval(() => {}, 1000)"],
			}),
		).rejects.toThrow(/readiness timeout/);
		expect(activeBrowserServers()).toBe(0);
	});

	test("fails on browser launch failure", async () => {
		await expect(
			launchBrowser({ executablePath: "/nonexistent/kore-chromium" }),
		).rejects.toBeInstanceOf(BrowserHarnessError);
		await expect(
			launchBrowser({ executablePath: "/nonexistent/kore-chromium" }),
		).rejects.toThrow(/browser launch failed/);
	});

	test("fails on build errors", async () => {
		// An unknown tsc option makes `bun run build` exit non-zero.
		await expect(
			ensureBrowserBuild({ force: true, command: ["bun", "run", "build", "--", "--definitely-bogus"] }),
		).rejects.toThrow(/browser build failed/);
	});

	test("launches a real browser against the generated bundle served by the harness server", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			// The generated bundle is what runs in the browser (16.2 deepens
			// the startup assertions); here the harness chain itself is proven.
			expect(await page.title()).toBe("KORE");
		} finally {
			await closeBrowser(browser);
			await server.stop();
		}
		expect(server.isAlive()).toBe(false);
		expect(activeBrowserServers()).toBe(0);
	});
});

/**
 * Section 16.2: browser boot and menu rendering.
 *
 * Opens the root URL in a real browser and proves that the generated game
 * bundle, the vendored p5 runtime, the menu, and the canvas initialize without
 * fatal browser errors. Console policy: uncaught page exceptions and
 * unexpected console `error` messages fail the test; the allowlist stays
 * empty because all first-party startup errors were removed.
 */

async function activeGameModeId(page: import("playwright").Page): Promise<string | null> {
	return await page.evaluate(() => {
		const handler = (window as any).game?.handler;
		return handler?.getSettings?.()?.gameMode?.id ?? null;
	});
}

test.describe("Section 16.2 browser boot and menu rendering", () => {
	test.afterAll(() => {
		expect(activeBrowserServers()).toBe(0);
	});

	test("boots the generated bundle, p5 canvas, and documented debug surface without fatal errors", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			const capture = captureConsole(page);

			// The game canvas becomes visible with non-zero dimensions.
			await waitFor(async () => {
				const geometry = await canvasGeometry(page);
				return geometry.width > 0 && geometry.height > 0;
			}, 10_000, 100, "game canvas");

			const info = await page.evaluate(() => {
				const game = (window as any).game;
				return {
					title: document.title,
					canvasCount: document.querySelectorAll("canvas").length,
					gameSurface: typeof game,
					gameKeys: game ? Object.keys(game).sort() : [],
					handlerCtor: game?.handler?.constructor?.name ?? null,
					settingsMode: game?.handler?.getSettings?.()?.gameMode?.id ?? null,
				};
			});

			expect(info.title).toBe("KORE");
			expect(info.canvasCount).toBeGreaterThan(0);
			expect(info.gameSurface).toBe("object");
			expect(info.gameKeys).toEqual(["audio", "handler", "logs", "mapId"]);
			expect(info.handlerCtor).toBe("GameHandler");
			// Menu state: no match settings before the play action.
			expect(info.settingsMode).toBeNull();

			// The documented debug surface reflects the active handler.
			const activeHandler = await page.evaluate(() => (window as any).game.handler.constructor.name);
			expect(activeHandler).toBe("GameHandler");

			// Console policy: no uncaught exceptions, no console errors.
			assertCleanConsole(capture);
		} finally {
			await closeBrowser(browser);
			await server.stop();
		}
		expect(server.isAlive()).toBe(false);
		expect(activeBrowserServers()).toBe(0);
	});

	test("menu exposes its local-play action and starts the canonical match through real clicks", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			const capture = captureConsole(page);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");

			// The SDK-composed KORE menu surface is active; no match exists yet.
			const menuHandler = await page.evaluate(() => (window as any).game.handler.getMouseHandler?.()?.constructor?.name ?? null);
			expect(menuHandler).toBe("KoreMainMenuSurface");
			expect(await activeGameModeId(page)).toBeNull();

			// Landing page: any press advances to the main menu page.
			await clickWorld(page, 400, 100);
			// Main menu page exposes "Play Local Game" in the centered bottom action row.
			await clickWorld(page, 551, 368);

			// The local-play action starts exactly one canonical match.
			await waitFor(async () => (await activeGameModeId(page)) === "local-ice-duel-v1", 10_000, 100, "canonical local match");
			const matchInfo = await page.evaluate(() => {
				const handler = (window as any).game.handler;
				return {
					settingsMode: handler?.getSettings?.()?.gameMode?.id ?? null,
					entities: handler?.getEntityManager?.()?.getEntities?.()?.length ?? 0,
				};
			});
			expect(matchInfo.settingsMode).toBe("local-ice-duel-v1");
			// Twelve figures (six per team) exist in the authoritative handler.
			expect(matchInfo.entities).toBe(12);

			assertCleanConsole(capture);
		} finally {
			await closeBrowser(browser);
			await server.stop();
		}
		expect(activeBrowserServers()).toBe(0);
	});

	test("console policy catches unexpected page errors and console errors", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await openPage(browser, server.url);
			const capture = captureConsole(page);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");
			// A clean page passes the policy gate.
			assertCleanConsole(capture);
			// Deliberately produce noise; the policy gate must fail on it.
			await page.evaluate(() => {
				console.error("kore deliberate console error");
				// An async throw is a true uncaught page exception.
				setTimeout(() => {
					throw new Error("kore deliberate page error");
				}, 0);
			});
			await waitFor(() => capture.pageErrors.length > 0, 5_000, 100, "page error capture");
			expect(() => assertCleanConsole(capture)).toThrow(/console policy violation/);
			expect(capture.errors).toContain("kore deliberate console error");
			expect(capture.pageErrors).toContain("kore deliberate page error");
		} finally {
			await closeBrowser(browser);
			await server.stop();
		}
		expect(server.isAlive()).toBe(false);
		expect(activeBrowserServers()).toBe(0);
	});

	test("menu Play Online joins the configured server and starts a matched game", async () => {
		await ensureBrowserBuild();
		// The harness server advertises itself through KORE_BASE_URL so the
		// join flow targets a real reachable WebSocket endpoint.
		const port = nextTestPort();
		const server = await startTestServer({ port, env: { KORE_BASE_URL: `http://localhost:${port}` } });
		const browser = await launchBrowser();
		try {
			// Tab A starts on the menu and clicks "Play Online".
			const pageA = await openPage(browser, server.url);
			const captureA = captureConsole(pageA);
			await waitFor(async () => (await canvasGeometry(pageA)).width > 0, 10_000, 100, "menu canvas");
			await clickWorld(pageA, 400, 100); // landing page -> main menu page
			// "Play Online" is the third button in the centered bottom action row.
			await clickWorld(pageA, 400, 368);
			// The online map page expresses a non-binding preference before join.
			await clickWorld(pageA, 400, 100);

			// The join action navigates to the configured server with skipmenu.
			await waitFor(async () => (await pageA.url()).includes("skipmenu=1"), 10_000, 100, "online join navigation");
			const joinedUrl = new URL(pageA.url());
			expect(joinedUrl.searchParams.get("skipmenu")).toBe("1");
			expect(joinedUrl.searchParams.get("url")).toBe(`ws://localhost:${port}/`);
			expect(joinedUrl.searchParams.get("map")).toBe("ice-map-v1");
			await waitFor(async () => await pageA.evaluate(() => !!(window as any).game?.handler), 10_000, 100, "online loading or match handler");

			// Tab B joins the same match from a fresh incognito context.
			const contextB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
			const pageB = await contextB.newPage();
			const captureB = captureConsole(pageB);
			const response = await pageB.goto(joinedUrl.toString(), { waitUntil: "load" });
			expect(response?.status()).toBe(200);

			// Matchmaking pairs both users and both tabs boot a game handler.
			const matchMode = (page: Page) =>
				page.evaluate(() => (window as any).game?.handler?.getSettings?.()?.gameMode?.id ?? null);
			await waitFor(async () => (await matchMode(pageA)) !== null, 20_000, 200, "tab A matched game");
			await waitFor(async () => (await matchMode(pageB)) !== null, 20_000, 200, "tab B matched game");
			const entities = await pageB.evaluate(
				() => (window as any).game?.handler?.getEntityManager?.()?.getEntities?.()?.length ?? 0,
			);
			expect(entities).toBeGreaterThan(0);

			assertCleanConsole(captureA);
			assertCleanConsole(captureB);
		} finally {
			await closeBrowser(browser);
			await server.stop();
		}
		expect(server.isAlive()).toBe(false);
		expect(activeBrowserServers()).toBe(0);
	});
});
