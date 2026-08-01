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

let nextPort = BASE_TEST_PORT;

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
		env: { ...process.env, PORT: String(port), GAME_DB_PATH: dbPath },
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

/** Launches the real Playwright Chromium browser; wraps launch failures. */
export async function launchBrowser(options: { executablePath?: string } = {}): Promise<Browser> {
	try {
		return await chromium.launch({ headless: true, ...(options.executablePath ? { executablePath: options.executablePath } : {}) });
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
