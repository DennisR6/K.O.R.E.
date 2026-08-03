import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

/**
 * Deterministic real-browser E2E harness (Section 16).
 *
 * The harness is the only sanctioned way for browser tests to reach the game:
 * it builds the generated `dist/main.js` bundle, spawns the real Bun
 * HTTP/WebSocket server on an isolated test port, waits for readiness, and
 * guarantees server termination after the test run (explicit `stop()`,
 * `afterAll` accounting, and a process-exit kill guard).
 *
 * All failure modes throw `BrowserHarnessError` so tests can assert that the
 * harness itself detects build errors, server startup errors, readiness
 * timeouts, browser launch failures, and leaked server processes.
 */

export const REPO_ROOT = join(import.meta.dir, "..", "..");

export class BrowserHarnessError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BrowserHarnessError";
	}
}

/** Default isolated test port; overridable so parallel workers cannot collide. */
const BASE_TEST_PORT = Number(process.env.E2E_TEST_PORT ?? 4187);

/**
 * Per-worker deterministic port sequence. The PID offset keeps parallel
 * workers (`bun test --parallel`, one Bun process per test file) on disjoint
 * port ranges, while the in-worker counter stays deterministic.
 */
const WORKER_PORT_OFFSET = (process.pid % 256) * 64;
let nextPort = BASE_TEST_PORT + WORKER_PORT_OFFSET;

/** Returns the next deterministic isolated test port for this worker. */
export function nextTestPort(): number {
	return nextPort++;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs the production browser build (`bun run build`) and throws on failure.
 * Memoized: the real build runs once per worker; `force` re-runs it, and
 * `command` overrides the build invocation (used by negative tests).
 */
let built = false;
export async function ensureBrowserBuild(options: { force?: boolean; command?: string[] } = {}): Promise<void> {
	if (built && !options.force) return;
	const command = options.command ?? ["bun", "run", "build"];
	const result = Bun.spawnSync({ cmd: command, cwd: REPO_ROOT, stdout: "pipe", stderr: "pipe" });
	if (result.exitCode !== 0) {
		const tail = [result.stdout, result.stderr]
			.map((chunk) => String(chunk ?? "").split("\n").slice(-8).join("\n"))
			.join("\n");
		throw new BrowserHarnessError(`browser build failed (exit ${result.exitCode})\n${tail}`);
	}
	built = true;
}

export interface StartedTestServer {
	/** Isolated port the server listens on. */
	readonly port: number;
	/** Root URL of the server (http://localhost:<port>). */
	readonly url: string;
	/** SQLite database path the server was started with. */
	readonly dbPath: string;
	/** True while the spawned server process is still alive. */
	isAlive(): boolean;
	/**
	 * Terminates the server process (SIGTERM, then SIGKILL), verifies the
	 * process actually exited, and removes the temporary database directory.
	 * Throws `BrowserHarnessError` when the process survives SIGKILL.
	 */
	stop(): Promise<void>;
}

/** Servers currently spawned by this worker (leak accounting). */
const activeServers = new Set<StartedTestServer>();

/** Snapshot of the number of servers this worker still has running. */
export function activeBrowserServers(): number {
	return activeServers.size;
}

// Kill guard: even if a test fails before calling stop(), the child never
// survives the worker process.
process.on("exit", () => {
	for (const server of activeServers) {
		try {
			const pid = (server as unknown as { pid: number }).pid;
			process.kill(pid, "SIGKILL");
		} catch {
			// already gone
		}
	}
});

export interface StartTestServerOptions {
	/** Isolated port; defaults to the next deterministic worker port. */
	port?: number;
	/** How long to poll for readiness before failing. */
	readinessTimeoutMs?: number;
	/** Poll interval while waiting for readiness. */
	pollIntervalMs?: number;
	/** SQLite database path; defaults to a fresh temp directory. */
	dbPath?: string;
	/** Extra environment variables for the spawned server (e.g. KORE_BASE_URL). */
	env?: Record<string, string>;
	/** Server command; defaults to the real `bun run server.ts`. */
	command?: string[];
}

/**
 * Spawns the real Bun HTTP/WebSocket server on an isolated test port and waits
 * until the root URL answers HTTP 200. Fails on child exit before readiness
 * (server startup error), readiness timeout, or leaked child processes.
 */
export async function startTestServer(options: StartTestServerOptions = {}): Promise<StartedTestServer> {
	const port = options.port ?? nextTestPort();
	const readinessTimeoutMs = options.readinessTimeoutMs ?? 15_000;
	const pollIntervalMs = options.pollIntervalMs ?? 100;
	const command = options.command ?? ["bun", "run", "server.ts"];
	const dbDir = mkdtempSync(join(tmpdir(), "kore-browser-test-"));
	const dbPath = options.dbPath ?? join(dbDir, "test.db");

	const proc = Bun.spawn({
		cmd: command,
		cwd: REPO_ROOT,
		env: { ...process.env, PORT: String(port), GAME_DB_PATH: dbPath, ...options.env },
		stdout: "pipe",
		stderr: "pipe",
	});

	let stderrTail = "";
	const readStderr = (async () => {
		try {
			stderrTail = await Bun.readableStreamToText(proc.stderr);
		} catch {
			// stream already consumed or closed; keep the accumulated tail
		}
	})();

	let stopped = false;
	const stop = async (): Promise<void> => {
		if (stopped) return;
		stopped = true;
		// Bun's Subprocess.exitCode can lag behind actual process death, so the
		// `exited` promise (which resolves after reap) is the authoritative
		// liveness signal here.
		let exited = await Promise.race([proc.exited.then(() => true), sleep(2_000).then(() => false)]);
		if (!exited) {
			proc.kill("SIGKILL");
			exited = await Promise.race([proc.exited.then(() => true), sleep(2_000).then(() => false)]);
		}
		await readStderr;
		activeServers.delete(server);
		rmSync(dbDir, { recursive: true, force: true });
		if (!exited) {
			throw new BrowserHarnessError(
				`server process leaked: pid ${proc.pid} still alive after SIGKILL on port ${port}`,
			);
		}
	};

	const server: StartedTestServer = {
		port,
		url: `http://localhost:${port}`,
		dbPath,
		isAlive(): boolean {
			try {
				process.kill(proc.pid, 0);
				return true;
			} catch {
				return false;
			}
		},
		stop,
	};
	activeServers.add(server);

	const deadline = Date.now() + readinessTimeoutMs;
	while (Date.now() < deadline) {
		// One poll tick races the child exit against the poll interval, so an
		// early exit is detected deterministically even before readiness.
		const exitCode = await Promise.race([
			proc.exited.then((code) => code),
			sleep(pollIntervalMs).then(() => null),
		]);
		if (exitCode !== null) {
			await stop();
			throw new BrowserHarnessError(
				`server startup failed (exit ${exitCode}, port ${port}):\n${stderrTail.split("\n").slice(-8).join("\n")}`,
			);
		}
		try {
			const response = await fetch(server.url);
			if (response.ok) return server;
		} catch {
			// not ready yet
		}
	}
	await stop();
	throw new BrowserHarnessError(
		`server readiness timeout after ${readinessTimeoutMs}ms on port ${port} (command: ${command.join(" ")})`,
	);
}

/**
 * Launches the real Playwright Chromium browser; wraps launch failures.
 * Headless by default (CI release gate). Set `BROWSER_HEADED=1` for a
 * documented local reproduction/debug mode - headed execution is never the
 * release gate.
 */
export async function launchBrowser(options: { executablePath?: string } = {}): Promise<Browser> {
	try {
		return await chromium.launch({
			headless: process.env.BROWSER_HEADED !== "1",
			...(options.executablePath ? { executablePath: options.executablePath } : {}),
		});
	} catch (error) {
		throw new BrowserHarnessError(`browser launch failed: ${errorMessage(error)}`);
	}
}

export interface PageConsoleCapture {
	/** All console messages (any level) with their type and text. */
	entries: Array<{ type: string; text: string }>;
	/** console `error`-level texts. */
	errors: string[];
	/** Uncaught page exception messages. */
	pageErrors: string[];
}

/**
 * Installs console/page-error capture on a page. `errors` collects console
 * `error`-level text, `pageErrors` collects uncaught page exceptions.
 */
export function captureConsole(page: Page): PageConsoleCapture {
	const capture: PageConsoleCapture = { entries: [], errors: [], pageErrors: [] };
	page.on("console", (message) => {
		const entry = { type: message.type(), text: message.text() };
		capture.entries.push(entry);
		if (message.type() === "error") capture.errors.push(message.text());
	});
	page.on("pageerror", (error) => capture.pageErrors.push(error.message));
	return capture;
}

/** Human-readable snapshot of a page's console capture for failure output. */
export function formatCapture(capture: PageConsoleCapture): string {
	const lines = [
		`console errors (${capture.errors.length}):`,
		...capture.errors.map((line) => `  ${line}`),
		`uncaught page errors (${capture.pageErrors.length}):`,
		...capture.pageErrors.map((line) => `  ${line}`),
	];
	return lines.join("\n");
}

/**
 * Console policy gate (Section 16.2): fails on uncaught page exceptions and
 * unexpected console `error` messages. `allowlist` accepts exact strings or
 * regexes only for known, reviewed noise; it must stay narrow and documented.
 */
export function assertCleanConsole(capture: PageConsoleCapture, allowlist: Array<string | RegExp> = []): void {
	const unexpectedErrors = capture.errors.filter((text) =>
		!allowlist.some((allowed) => (typeof allowed === "string" ? text === allowed : allowed.test(text))),
	);
	const unexpectedPageErrors = capture.pageErrors.slice();
	if (unexpectedErrors.length === 0 && unexpectedPageErrors.length === 0) return;
	throw new BrowserHarnessError(
		`browser console policy violation\n${formatCapture({
			entries: [],
			errors: unexpectedErrors,
			pageErrors: unexpectedPageErrors,
		})}`,
	);
}

/** Convenience: opens a page, navigates to `url`, waits for the load event. */
export async function openPage(browser: Browser, url: string): Promise<Page> {
	const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
	const response = await page.goto(url, { waitUntil: "load" });
	if (!response || response.status() !== 200) {
		await page.close();
		throw new BrowserHarnessError(`page failed to load ${url}: ${response?.status() ?? "no response"}`);
	}
	return page;
}

/** Resolves when `predicate` returns true, polling every `intervalMs`. */
export async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs: number, intervalMs = 100, what = "condition"): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await predicate()) return;
		await sleep(intervalMs);
	}
	throw new BrowserHarnessError(`timed out waiting for ${what}`);
}

/** Canonical world size the adapted browser canvas maps to (GameSettings). */
export const BROWSER_WORLD = { width: 800, height: 450 };

export interface CanvasGeometry {
	left: number;
	top: number;
	width: number;
	height: number;
}

/** Bounding box of the p5 game canvas in viewport pixels. */
export async function canvasGeometry(page: Page): Promise<CanvasGeometry> {
	return await page.evaluate(() => {
		const canvas = document.querySelector("canvas");
		if (!canvas) throw new Error("no canvas element");
		const rect = canvas.getBoundingClientRect();
		return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
	});
}

/** Converts world coordinates to viewport pixels for the fit-world canvas. */
export function worldToPixel(geometry: CanvasGeometry, worldX: number, worldY: number): { x: number; y: number } {
	const scale = Math.min(geometry.width / BROWSER_WORLD.width, geometry.height / BROWSER_WORLD.height);
	const offsetX = (geometry.width - BROWSER_WORLD.width * scale) / 2;
	const offsetY = (geometry.height - BROWSER_WORLD.height * scale) / 2;
	return { x: geometry.left + offsetX + worldX * scale, y: geometry.top + offsetY + worldY * scale };
}

/** Performs a real mouse click at world coordinates on the game canvas. */
export async function clickWorld(page: Page, worldX: number, worldY: number): Promise<void> {
	const pixel = worldToPixel(await canvasGeometry(page), worldX, worldY);
	await page.mouse.click(pixel.x, pixel.y);
}

/**
 * Performs a real drag gesture (move -> down -> intermediate moves -> up)
 * between world coordinates on the game canvas.
 */
export async function dragWorld(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 4): Promise<void> {
	const geometry = await canvasGeometry(page);
	const start = worldToPixel(geometry, from.x, from.y);
	const end = worldToPixel(geometry, to.x, to.y);
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	for (let step = 1; step <= steps; step++) {
		const t = step / steps;
		await page.mouse.move(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t);
	}
	await page.mouse.up();
}

/** Reads the authoritative match state from the documented debug surface. */
export async function readMatchState(page: Page): Promise<{
	state: string;
	turnNumber: number;
	activeTeam: number;
	phase: string;
	itemUses: number;
	playbackFrames: number;
	entities: Array<{ id: string; x: number; y: number; vx: number; vy: number; dead: boolean; team: number[] }>;
}> {
	return await page.evaluate(() => {
		const handler = (window as any).game.handler;
		const entities = handler.getEntityManager().getEntities().map((entity: any) => ({
			id: entity.getId(),
			x: entity.getPos().x,
			y: entity.getPos().y,
			vx: entity.getVel?.()?.x ?? 0,
			vy: entity.getVel?.()?.y ?? 0,
			dead: entity.isDead(),
			team: entity.getTeam(),
		}));
		const ruleState = handler.getRuleState();
		return {
			state: handler.getState(),
			turnNumber: handler.getTurnNumber(),
			activeTeam: handler.getActiveTeam(),
			phase: ruleState.phase,
			itemUses: ruleState.itemUses,
			playbackFrames: handler.getPlaybackFramesRemaining?.(),
			entities,
		};
	});
}

/** Reads the game mode id of the active handler (null outside a match). */
export async function activeGameModeId(page: Page): Promise<string | null> {
	return await page.evaluate(() => {
		const handler = (window as any).game?.handler;
		return handler?.getSettings?.()?.gameMode?.id ?? null;
	});
}

/** True when every entity position/velocity is finite. */
export function finiteEntities(state: { entities: Array<{ x: number; y: number; vx: number; vy: number }> }): boolean {
	return state.entities.every(entity => Number.isFinite(entity.x) && Number.isFinite(entity.y) && Number.isFinite(entity.vx) && Number.isFinite(entity.vy));
}
