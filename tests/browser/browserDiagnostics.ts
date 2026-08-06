import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright";
import { REPO_ROOT, type PageConsoleCapture } from "./browserHarness.ts";

/**
 * Section 16.5: concise, bounded failure evidence for browser runs.
 *
 * A `BrowserDiagnostics` instance records the interaction steps and a small
 * allowlisted metadata set of a browser test run. On failure, `capture()`
 * writes one timestamped artifact directory under `.browser-diagnostics/`
 * (git-ignored) containing:
 *
 * - `screenshot.png`       - page screenshot at capture time
 * - `console.txt`          - bounded console output (all levels, newest last)
 * - `page-errors.txt`      - uncaught page exception messages
 * - `context.txt`          - URL, viewport, browser version, run name, the
 *                            capture reason, and the recorded configuration;
 *                            contains NO environment values, credentials, or
 *                            database contents
 * - `interaction.log`      - bounded ordered step log identifying the last
 *                            completed browser step before the failure
 *
 * The interaction log and console output are hard-bounded so a pathological
 * page can never grow the artifacts without limit.
 */

export const BROWSER_DIAGNOSTICS_ROOT = join(REPO_ROOT, ".browser-diagnostics");

/** Hard bounds: never write more than this many interaction steps or console lines. */
export const MAX_INTERACTION_ENTRIES = 200;
export const MAX_CONSOLE_LINES = 500;

/** The artifact file names produced by `capture()`. */
export const DIAGNOSTIC_ARTIFACTS = ["screenshot.png", "console.txt", "page-errors.txt", "context.txt", "interaction.log"] as const;

function sanitizeRunName(name: string): string {
	return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "browser-run";
}

export class BrowserDiagnostics {
	private readonly entries: string[] = [];
	private readonly metadata = new Map<string, string>();
	private readonly dir: string;
	private captured = false;

	/**
	 * @param runName Short stable identifier of the test/scenario. It is
	 * sanitized into the artifact directory name (timestamped per run).
	 */
	public constructor(runName: string) {
		this.dir = join(BROWSER_DIAGNOSTICS_ROOT, `${sanitizeRunName(runName)}-${Date.now()}`);
	}

	/** Records an allowlisted configuration/metadata key (never raw env). */
	public record(key: string, value: string): void {
		this.metadata.set(key, value);
	}

	/** Appends a bounded interaction step; the newest steps are kept. */
	public step(label: string): void {
		this.entries.push(`${new Date().toISOString()} ${label}`);
		if (this.entries.length > MAX_INTERACTION_ENTRIES) this.entries.shift();
	}

	/** The artifact directory of this run (created on first `capture()`). */
	public get directory(): string {
		return this.dir;
	}

	/** True once artifacts have been written; a second capture is a no-op. */
	public get isCaptured(): boolean {
		return this.captured;
	}

	/**
	 * Writes all diagnostic artifacts for the current page state. The capture
	 * never throws: evidence collection must not mask the original failure.
	 * Returns the written file paths (empty when the capture already ran).
	 */
	public async capture(page: Page, capture: PageConsoleCapture, reason: string): Promise<string[]> {
		if (this.captured) return [];
		this.captured = true;
		mkdirSync(this.dir, { recursive: true });
		const files: string[] = [];

		try {
			const screenshotPath = join(this.dir, "screenshot.png");
			await page.screenshot({ path: screenshotPath });
			files.push(screenshotPath);
		} catch {
			// screenshot is best-effort (e.g. page already closed)
		}

		const consoleLines = capture.entries.map((entry) => `[${entry.type}] ${entry.text}`);
		const consolePath = join(this.dir, "console.txt");
		writeFileSync(consolePath, `${consoleLines.slice(-MAX_CONSOLE_LINES).join("\n")}\n`);
		files.push(consolePath);

		const pageErrorsPath = join(this.dir, "page-errors.txt");
		writeFileSync(pageErrorsPath, `${capture.pageErrors.join("\n")}\n`);
		files.push(pageErrorsPath);

		const contextPath = join(this.dir, "context.txt");
		writeFileSync(contextPath, await this.buildContextText(page, reason));
		files.push(contextPath);

		const interactionPath = join(this.dir, "interaction.log");
		writeFileSync(interactionPath, `${this.entries.join("\n")}\n`);
		files.push(interactionPath);

		return files;
	}

	/** Builds the allowlisted context text (never reads process.env). */
	private async buildContextText(page: Page, reason: string): Promise<string> {
		let browserInfo = "unknown";
		try {
			const version = await page.context().browser()?.version();
			browserInfo = version ? `chromium ${version}` : "unknown";
		} catch {
			// browser already closed
		}
		const viewport = page.viewportSize() ?? { width: 0, height: 0 };
		const lines = [
			`reason: ${reason}`,
			`run name: ${sanitizeRunName(this.dir.split("/").pop() ?? "browser-run")}`,
			`url: ${page.url()}`,
			`viewport: ${viewport.width}x${viewport.height}`,
			`browser: ${browserInfo}`,
		];
		for (const [key, value] of this.metadata) lines.push(`${key}: ${value}`);
		return `${lines.join("\n")}\n`;
	}
}

/**
 * Runs a browser scenario body and captures diagnostics on failure, then
 * rethrows the original error so the test still fails normally. The
 * diagnostics instance must already be attached and stepped by the caller.
 */
export async function runWithDiagnostics<T>(
	diag: BrowserDiagnostics,
	page: Page,
	capture: PageConsoleCapture,
	body: () => Promise<T>,
): Promise<T> {
	try {
		return await body();
	} catch (error) {
		await diag.capture(page, capture, error instanceof Error ? error.message : String(error));
		throw error;
	}
}
