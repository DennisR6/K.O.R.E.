import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "@playwright/test";

/**
 * Deterministic real-browser E2E harness (Section 16).
 *
 * The harness is the only sanctioned way for browser tests to reach the game:
 * it builds the generated `dist/main.js` bundle, spawns the real Bun
 * HTTP/WebSocket server on an isolated test port, waits for readiness, and
 * guarantees server termination after the test run (explicit `stop()`,
 * `afterAll` accounting, and a process-exit kill guard).
 *
 * The harness is runner-agnostic node code consumed by the `@playwright/test`
 * specs in this directory: it launches Playwright Chromium itself (no fixture
 * pages) and manages the Bun server/build as child processes.
 *
 * All failure modes throw `BrowserHarnessError` so tests can assert that the
 * harness itself detects build errors, server startup errors, readiness
 * timeouts, browser launch failures, and leaked server processes.
 */

// Derived from this module's own URL so the harness stays correct regardless
// of the process working directory or the transpiler (playwright shims
// `import.meta.url`, but not `import.meta.dir`).
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export class BrowserHarnessError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BrowserHarnessError";
	}
}

/** Default isolated test port; overridable so parallel workers cannot collide. */
const BASE_TEST_PORT = Number(process.env.E2E_TEST_PORT ?? 4187);

/**
 * Per-worker deterministic port sequence. The PID-derived offset keeps
 * parallel workers (one node worker process per `@playwright/test` worker) on
 * disjoint port ranges, while the in-worker counter stays deterministic.
 *
 * The modulus is 900, not 256: workers can share PIDs modulo 256 (observed
 * with two parallel Bun workers both `pid % 256 == 1`), which would make
 * them share the entire port sequence. PIDs within ~57600 of each other are
 * always distinct modulo 900, and `startTestServer` probes ports and retries
 * on EADDRINUSE as a final safety net.
 */
const WORKER_PORT_OFFSET = (process.pid % 900) * 64;
let nextPort = BASE_TEST_PORT + WORKER_PORT_OFFSET;

/** Returns the next deterministic isolated test port for this worker. */
export function nextTestPort(): number {
	return nextPort++;
}

/**
 * True when a TCP listener already answers on `port` (a sibling parallel
 * worker's server or a stale server from a crashed run). Used to skip busy
 * ports before spawning; the EADDRINUSE retry in `startTestServer` closes the
 * small probe-to-spawn race window.
 */
function portProbe(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = createConnection({ host: "127.0.0.1", port });
		const done = (result: boolean) => {
			socket.destroy();
			resolve(result);
		};
		socket.once("connect", () => done(true));
		socket.once("error", () => done(false));
		socket.setTimeout(1_000, () => done(false));
	});
}

/**
 * Process state character from /proc/<pid>/stat, or null when the process is
 * gone (or /proc is unavailable). `Z` marks a zombie: dead but not yet reaped.
 */
function processStateChar(pid: number): string | null {
	try {
		const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
		const match = stat.match(/\)\s+([A-Za-z])/);
		return match ? match[1] : null;
	} catch {
		return null; // ESRCH or non-Linux
	}
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
 *
 * The build is additionally single-flight across parallel workers: every
 * `bun test --parallel` worker would otherwise spawn its own `bun run build`
 * and the concurrent tsc/cp writes would tear `dist/` while pages load it.
 * A lock directory serializes the build; its owner PID lets a crashed worker's
 * stale lock be reclaimed.
 */
let built = false;

const BUILD_LOCK_DIR = join(REPO_ROOT, ".browser-build.lock");
const BUILD_LOCK_ACQUIRE_TIMEOUT_MS = 300_000;
const BUILD_LOCK_POLL_MS = 250;

function buildLockOwner(): number | null {
	try {
		const pid = Number(readFileSync(join(BUILD_LOCK_DIR, "pid"), "utf8").trim());
		return Number.isInteger(pid) && pid > 0 ? pid : null;
	} catch {
		return null;
	}
}

function processAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function acquireBuildLock(): Promise<void> {
	const deadline = Date.now() + BUILD_LOCK_ACQUIRE_TIMEOUT_MS;
	for (;;) {
		try {
			mkdirSync(BUILD_LOCK_DIR);
			writeFileSync(join(BUILD_LOCK_DIR, "pid"), String(process.pid));
			return;
		} catch {
			// Lock exists; reclaim it if the owning worker is gone.
			const owner = buildLockOwner();
			if (owner !== null && processAlive(owner)) {
				if (Date.now() >= deadline) {
					throw new BrowserHarnessError("timed out waiting for the shared browser build lock");
				}
				await sleep(BUILD_LOCK_POLL_MS);
				continue;
			}
			rmSync(BUILD_LOCK_DIR, { recursive: true, force: true });
		}
	}
}

function releaseBuildLock(): void {
	rmSync(BUILD_LOCK_DIR, { recursive: true, force: true });
}

/**
 * True when the generated bundle is newer than every build input (src, public,
 * tsconfig, index.html, server.ts, package.json). Lets parallel workers share
 * one build: the first worker builds under the lock, the rest skip instead of
 * re-running (and waiting on) the build, which would otherwise eat their
 * per-test timeouts.
 */
function distIsFresh(): boolean {
	let main: ReturnType<typeof statSync>;
	try {
		main = statSync(join(REPO_ROOT, "dist", "main.js"));
	} catch {
		return false;
	}
	let newest = main.mtimeMs;
	const scan = (dir: string): void => {
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) scan(full);
			else if (entry.isFile()) {
				try {
					newest = Math.max(newest, statSync(full).mtimeMs);
				} catch {
					// unreadable inputs are not fresher
				}
			}
		}
	};
	scan(join(REPO_ROOT, "src"));
	scan(join(REPO_ROOT, "public"));
	for (const file of ["tsconfig.json", "index.html", "server.ts", "package.json"]) {
		try {
			newest = Math.max(newest, statSync(join(REPO_ROOT, file)).mtimeMs);
		} catch {
			// missing input is not fresher
		}
	}
	return newest <= main.mtimeMs;
}

export async function ensureBrowserBuild(options: { force?: boolean; command?: string[] } = {}): Promise<void> {
	if (built && !options.force) return;
	const command = options.command ?? ["bun", "run", "build"];
	await acquireBuildLock();
	try {
		// Another worker may have built while we waited for the lock.
		if (built && !options.force) return;
		// A fresh bundle means a sibling worker already built it.
		if (!options.force && distIsFresh()) {
			built = true;
			return;
		}
		const result = spawnSync(command[0], command.slice(1), { cwd: REPO_ROOT, encoding: "utf8" });
		if (result.status !== 0) {
			const tail = [result.stdout, result.stderr]
				.map((chunk) => String(chunk ?? "").split("\n").slice(-8).join("\n"))
				.join("\n");
			throw new BrowserHarnessError(`browser build failed (exit ${result.status})\n${tail}`);
		}
		built = true;
	} finally {
		releaseBuildLock();
	}
}

/**
 * Runs a bun-only helper script (e.g. SQLite fixture preparation that needs
 * `bun:sqlite`) as a child process and returns its trimmed stdout. Throws
 * `BrowserHarnessError` with the helper's stderr when it fails.
 */
export function runBunScript(script: string, args: string[]): string {
	const result = spawnSync("bun", ["run", script, ...args], { cwd: REPO_ROOT, encoding: "utf8" });
	if (result.status !== 0) {
		throw new BrowserHarnessError(
			`bun helper ${script} failed (exit ${result.status}):\n${String(result.stderr ?? "").split("\n").slice(-8).join("\n")}`,
		);
	}
	return String(result.stdout ?? "").trim();
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
 *
 * The chosen port is probed first and, when the port was not explicitly
 * requested, an EADDRINUSE startup failure transparently retries on the next
 * worker port. This makes collisions with sibling parallel workers impossible
 * even though the per-worker sequence is deterministic.
 */
export async function startTestServer(options: StartTestServerOptions = {}): Promise<StartedTestServer> {
	const explicitPort = options.port !== undefined;
	let port = options.port ?? nextTestPort();
	if (!explicitPort) {
		while (await portProbe(port)) port = nextTestPort();
	}
	const maxAttempts = explicitPort ? 1 : 5;
	for (let attempt = 1; ; attempt++) {
		try {
			return await spawnTestServer({ ...options, port });
		} catch (error) {
			const retryable =
				error instanceof BrowserHarnessError && /address already in use|EADDRINUSE/i.test(error.message);
			if (!retryable || attempt >= maxAttempts) throw error;
			port = nextTestPort();
			while (await portProbe(port)) port = nextTestPort();
		}
	}
}

async function spawnTestServer(options: StartTestServerOptions): Promise<StartedTestServer> {
	const port = options.port ?? nextTestPort();
	const readinessTimeoutMs = options.readinessTimeoutMs ?? 15_000;
	const pollIntervalMs = options.pollIntervalMs ?? 100;
	const command = options.command ?? ["bun", "run", "server.ts"];
	const dbDir = mkdtempSync(join(tmpdir(), "kore-browser-test-"));
	const dbPath = options.dbPath ?? join(dbDir, "test.db");

	const proc = spawn(command[0], command.slice(1), {
		cwd: REPO_ROOT,
		env: { ...process.env, PORT: String(port), GAME_DB_PATH: dbPath, ...options.env },
		stdio: ["ignore", "pipe", "pipe"],
	});

	let stderrTail = "";
	proc.stderr.setEncoding("utf8");
	const readStderr = (async () => {
		try {
			for await (const chunk of proc.stderr) stderrTail += chunk;
		} catch {
			// stream already consumed or closed; keep the accumulated tail
		}
	})();

	// Resolves once the child has been reaped (node's "exit" event). The
	// value is the exit code, a `signal <name>` marker when killed by a
	// signal, or 0 when the stream closed without an observed exit.
	const exited = once(proc, "exit").then(([code, signal]) => code ?? (signal ? `signal ${signal}` : 0));

	let stopped = false;
	const stop = async (): Promise<void> => {
		if (stopped) return;
		stopped = true;
		// The `exited` promise (which resolves after reap) is the authoritative
		// liveness signal here; a poll tolerates reap lag under load and
		// accepts an already-reaped (ESRCH) process.
		let didExit = await Promise.race([exited.then(() => true), sleep(2_000).then(() => false)]);
		if (!didExit) {
			proc.kill("SIGKILL");
			const deadline = Date.now() + 5_000;
			while (Date.now() < deadline) {
				didExit = await Promise.race([exited.then(() => true), sleep(250).then(() => false)]);
				if (didExit) break;
				const state = processStateChar(proc.pid);
				// A zombie is dead but unreaped; treat it as exited so it
				// cannot fail the test. R/S/D states are a leak.
				if (state === null || state === "Z") {
					didExit = true;
					break;
				}
			}
		}
		if (!didExit) {
			// The process survived SIGKILL (e.g. D-state IO stall). Throw
			// before touching its pipes: reading them would hang forever.
			activeServers.delete(server);
			throw new BrowserHarnessError(
				`server process leaked: pid ${proc.pid} still alive after SIGKILL on port ${port} (state ${processStateChar(proc.pid) ?? "?"})`,
			);
		}
		// Process is dead; consume its streams with a bound so a stalled pipe
		// can never hang cleanup.
		await Promise.race([readStderr, sleep(2_000).then(() => undefined)]);
		activeServers.delete(server);
		rmSync(dbDir, { recursive: true, force: true });
	};

	const server: StartedTestServer = {
		port,
		url: `http://localhost:${port}`,
		dbPath,
		isAlive(): boolean {
			const state = processStateChar(proc.pid);
			// A zombie holds no port and is dead; only live states count.
			return state !== null && state !== "Z";
		},
		stop,
	};
	activeServers.add(server);

	const deadline = Date.now() + readinessTimeoutMs;
	while (Date.now() < deadline) {
		// One poll tick races the child exit against the poll interval, so an
		// early exit is detected deterministically even before readiness.
		const exitCode = await Promise.race([exited, sleep(pollIntervalMs).then(() => null)]);
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
		`server readiness timeout after ${readinessTimeoutMs}ms on port ${port} (command: ${command.join(" ")}):\n${stderrTail.split("\n").slice(-8).join("\n")}`,
	);
}

/**
 * Launches the real Playwright Chromium browser; wraps launch failures.
 * Headless by default (CI release gate). Set `BROWSER_HEADED=1` for a
 * documented local reproduction/debug mode - headed execution is never the
 * release gate.
 *
 * A transient launch crash (the headless shell occasionally dies at startup)
 * is retried once; deterministic failures (missing binary, bad options) still
 * throw.
 */
export async function launchBrowser(options: { executablePath?: string } = {}): Promise<Browser> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= 2; attempt++) {
		try {
			const browser = await chromium.launch({
				headless: process.env.BROWSER_HEADED !== "1",
				...(options.executablePath ? { executablePath: options.executablePath } : {}),
			});
			// Diagnose unexpected browser deaths: log the exit code and signal
			// whenever the browser process goes away while the test still uses
			// it. A clean exit (code 0) means something closed it; a signal
			// (e.g. SIGKILL) means an external killer; other codes are crashes.
			// (`browser.process()` is a Chromium-only Node API; it is guarded
			// so the same harness stays portable across runtimes.)
			const proc = (browser as { process?: () => { exitCode?: number | null; signalCode?: string | null } }).process?.();
			(browser as Browser & { __browserExitInfo?: string }).__browserExitInfo = undefined;
			browser.on("disconnected", () => {
				const info = proc
					? `browser disconnected: exitCode=${proc.exitCode ?? "n/a"} signal=${proc.signalCode ?? "n/a"}`
					: "browser disconnected (exit code unavailable in this runtime)";
				(browser as Browser & { __browserExitInfo?: string }).__browserExitInfo = info;
				console.error(`[browser-debug] ${info}`);
			});
			return browser;
		} catch (error) {
			lastError = error;
			await sleep(attempt * 500);
		}
	}
	throw new BrowserHarnessError(`browser launch failed: ${errorMessage(lastError)}`);
}

/**
 * Closes a browser without throwing: the browser may already be gone (e.g. a
 * renderer crash killed the process), and a throwing `browser.close()` inside
 * a test `finally` would skip the subsequent `server.stop()` and leak the
 * server. Cleanup must never fail the cleanup itself.
 */
export async function closeBrowser(browser: Browser): Promise<void> {
	try {
		await browser.close();
	} catch {
		// already closed, crashed, or disconnected; nothing to clean up
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
	// Diagnose renderer crashes: the page's main thread dies while the browser
	// process itself survives, which leaves pending protocol calls (evaluate,
	// mouse input) hanging forever unless they are bounded separately.
	page.on("crash", () => {
		console.error("[browser-debug] page renderer crashed");
		(page as Page & { __pageCrashed?: boolean }).__pageCrashed = true;
	});
	const response = await boundedPageCall(page.goto(url, { waitUntil: "load" }), "page load", 60_000);
	if (!response || response.status() !== 200) {
		await closeBrowser(browser);
		throw new BrowserHarnessError(`page failed to load ${url}: ${response?.status() ?? "no response"}`);
	}
	return page;
}

/** Resolves when `predicate` returns true, polling every `intervalMs`. */
export async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs: number, intervalMs = 100, what = "condition"): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		// Race every predicate evaluation against the remaining deadline: a
		// predicate that never settles (e.g. a page whose renderer died, so
		// `page.evaluate` stays pending forever) must fail the wait cleanly
		// instead of hanging the test until its outer timeout.
		const remaining = deadline - Date.now();
		if (remaining <= 0) throw new BrowserHarnessError(`timed out waiting for ${what}`);
		const result = await Promise.race([
			Promise.resolve().then(predicate),
			sleep(remaining).then(() => undefined),
		]);
		if (result === undefined) throw new BrowserHarnessError(`timed out waiting for ${what}`);
		if (result) return;
		await sleep(intervalMs);
	}
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
	return await boundedPageCall(
		page.evaluate(() => {
			const canvas = document.querySelector("canvas");
			if (!canvas) throw new Error("no canvas element");
			const rect = canvas.getBoundingClientRect();
			return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
		}),
		"canvas geometry",
	);
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
	await boundedPageCall(page.mouse.click(pixel.x, pixel.y), "mouse click");
}

/**
 * Performs a real drag gesture (move -> down -> intermediate moves -> up)
 * between world coordinates on the game canvas.
 */
export async function dragWorld(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 4): Promise<void> {
	const geometry = await canvasGeometry(page);
	const start = worldToPixel(geometry, from.x, from.y);
	const end = worldToPixel(geometry, to.x, to.y);
	await boundedPageCall(page.mouse.move(start.x, start.y), "mouse move");
	await boundedPageCall(page.mouse.down(), "mouse down");
	for (let step = 1; step <= steps; step++) {
		const t = step / steps;
		await boundedPageCall(
			page.mouse.move(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t),
			"mouse move",
		);
	}
	await boundedPageCall(page.mouse.up(), "mouse up");
}

/** Reads the authoritative match state from the documented debug surface. */
export async function readMatchState(page: Page): Promise<{
	state: string;
	turnNumber: number;
	activeTeam: number;
	phase: string;
	itemUses: number;
	playbackFrames: number | undefined;
	paused: boolean;
	entities: Array<{ id: string; x: number; y: number; vx: number; vy: number; dead: boolean; team: number[] }>;
}> {
	return await boundedPageCall(
		page.evaluate(() => {
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
				paused: handler.isPaused?.() === true,
				entities,
			};
		}),
		"match state",
	);
}

/**
 * Bounds a page protocol call so a renderer that died (or a main thread that
 * is stuck in an infinite loop) fails the test cleanly with a diagnostic
 * instead of hanging it until the outer test timeout.
 */
async function boundedPageCall<T>(call: Promise<T>, what: string, timeoutMs = 30_000): Promise<T> {
	return await Promise.race([
		call,
		sleep(timeoutMs).then(() => {
			throw new BrowserHarnessError(`page call timed out (${what}); the page is unresponsive or dead`);
		}),
	]);
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
