import { describe, expect, test, afterAll } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	BrowserHarnessError,
	activeBrowserServers,
	ensureBrowserBuild,
	launchBrowser,
	nextTestPort,
	openPage,
	startTestServer,
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
describe("Section 16.1 browser harness", () => {
	afterAll(() => {
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
	}, 120_000);

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
	}, 30_000);

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
	}, 30_000);

	test("fails on browser launch failure", async () => {
		await expect(
			launchBrowser({ executablePath: "/nonexistent/kore-chromium" }),
		).rejects.toBeInstanceOf(BrowserHarnessError);
		await expect(
			launchBrowser({ executablePath: "/nonexistent/kore-chromium" }),
		).rejects.toThrow(/browser launch failed/);
	}, 30_000);

	test("fails on build errors", async () => {
		// An unknown tsc option makes `bun run build` exit non-zero.
		await expect(
			ensureBrowserBuild({ force: true, command: ["bun", "run", "build", "--", "--definitely-bogus"] }),
		).rejects.toThrow(/browser build failed/);
	}, 30_000);

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
			await browser.close();
			await server.stop();
		}
		expect(server.isAlive()).toBe(false);
		expect(activeBrowserServers()).toBe(0);
	}, 120_000);
});
