import { describe, expect, test, afterAll } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import {
	activeBrowserServers,
	assertCleanConsole,
	BrowserHarnessError,
	captureConsole,
	canvasGeometry,
	ensureBrowserBuild,
	launchBrowser,
	openPage,
	startTestServer,
	waitFor,
} from "./browserHarness.ts";
import {
	BrowserDiagnostics,
	DIAGNOSTIC_ARTIFACTS,
	MAX_CONSOLE_LINES,
	MAX_INTERACTION_ENTRIES,
} from "./browserDiagnostics.ts";

/**
 * Section 16.5: browser failure artifacts and diagnostics.
 *
 * A deliberately failing fixture proves that a failing browser run produces
 * the bounded evidence set (screenshot, console output, uncaught page errors,
 * URL/viewport/browser context, and an interaction log that identifies the
 * failed step) without leaking secrets or unbounded logs.
 */

describe("Section 16.5 browser failure diagnostics", () => {
	afterAll(() => {
		expect(activeBrowserServers()).toBe(0);
	});

	test("deliberately failing fixture produces the expected bounded artifacts", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		const diag = new BrowserDiagnostics("diagnostics-fixture");
		try {
			const page = await openPage(browser, server.url);
			const capture = captureConsole(page);
			diag.record("fixture", "deliberate failure proof");
			diag.step("open root page");
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");
			diag.step("canvas visible");

			// Seed a planted secret and prove the artifacts never leak it.
			const secretMarker = "diagnostics-secret-marker-should-never-appear";
			process.env.DIAGNOSTICS_SECRET_MARKER = secretMarker;

			// Flood the console to prove the artifact is bounded.
			await page.evaluate((floodCount) => {
				for (let index = 0; index < floodCount; index++) console.log(`bulk console line ${index}`);
				console.error("fixture console error marker");
				setTimeout(() => {
					throw new Error("fixture uncaught page error marker");
				}, 0);
			}, MAX_CONSOLE_LINES + 50);
			await waitFor(() => capture.pageErrors.length >= 1, 5_000, 50, "uncaught page error");
			diag.step("injected console error and uncaught exception");

			// The deliberately failing step: the last completed step is
			// recorded, then the fixture fails and captures the evidence.
			let failure: unknown;
			try {
				diag.step("entering diagnostic-failing-step");
				await waitFor(() => false, 1_500, 100, "diagnostic-failing-step");
			} catch (error) {
				failure = error;
			}
			expect(failure).toBeInstanceOf(BrowserHarnessError);
			expect((failure as Error).message).toContain("diagnostic-failing-step");

			const files = await diag.capture(page, capture, "deliberate fixture failure");
			expect(diag.isCaptured).toBe(true);
			for (const artifact of DIAGNOSTIC_ARTIFACTS) {
				const path = files.find(file => file.endsWith(`/${artifact}`) || file.endsWith(`\\${artifact}`));
				expect(path, artifact).toBeTruthy();
				expect(existsSync(path!)).toBe(true);
			}

			// Screenshot is a real image (non-empty PNG).
			const screenshotPath = files.find(file => file.endsWith("screenshot.png"))!;
			expect(statSync(screenshotPath).size).toBeGreaterThan(0);

			// Console artifact is bounded: the oldest flooded lines are dropped.
			const consoleText = readFileSync(files.find(file => file.endsWith("console.txt"))!, "utf8");
			expect(consoleText).toContain("fixture console error marker");
			expect(consoleText).not.toContain("bulk console line 0");
			expect(consoleText).toContain(`bulk console line ${MAX_CONSOLE_LINES + 49}`);
			expect(consoleText.split("\n").length).toBeLessThanOrEqual(MAX_CONSOLE_LINES + 2);

			// Uncaught page errors artifact.
			const pageErrorsText = readFileSync(files.find(file => file.endsWith("page-errors.txt"))!, "utf8");
			expect(pageErrorsText).toContain("fixture uncaught page error marker");

			// Context artifact: URL, viewport, browser, configuration, the
			// failed step - and never the planted secret or raw env.
			const contextText = readFileSync(files.find(file => file.endsWith("context.txt"))!, "utf8");
			expect(contextText).toContain(server.url);
			expect(contextText).toContain("1280x720");
			expect(contextText).toContain("chromium");
			expect(contextText).toContain("fixture: deliberate failure proof");
			expect(contextText).toContain("reason: deliberate fixture failure");
			expect(contextText).not.toContain(secretMarker);
			expect(contextText).not.toContain("DIAGNOSTICS_SECRET_MARKER");

			// Interaction log is bounded and identifies the failed step.
			const interactionText = readFileSync(files.find(file => file.endsWith("interaction.log"))!, "utf8");
			expect(interactionText).toContain("entering diagnostic-failing-step");
			expect(interactionText).toContain("canvas visible");
			expect(interactionText.split("\n").length).toBeLessThanOrEqual(MAX_INTERACTION_ENTRIES + 2);

			// A second capture is a no-op (evidence never overwritten).
			const again = await diag.capture(page, capture, "again");
			expect(again).toEqual([]);
			expect(existsSync(files.find(file => file.endsWith("context.txt"))!)).toBe(true);

			// The fixture itself produced expected console noise; assert the
			// capture surface recorded it before the cleanup of the marker.
			expect(capture.errors).toContain("fixture console error marker");

			delete process.env.DIAGNOSTICS_SECRET_MARKER;
		} finally {
			delete process.env.DIAGNOSTICS_SECRET_MARKER;
			await browser.close();
			await server.stop();
		}
		expect(activeBrowserServers()).toBe(0);
	}, 120_000);

	test("clean browser run stays free of console noise and diagnostics", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		const diag = new BrowserDiagnostics("clean-run");
		try {
			const page = await openPage(browser, server.url);
			const capture = captureConsole(page);
			diag.step("open root page");
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "game canvas");
			diag.step("canvas visible");
			assertCleanConsole(capture);
			// No failure -> no artifacts captured.
			expect(diag.isCaptured).toBe(false);
		} finally {
			await browser.close();
			await server.stop();
		}
		expect(activeBrowserServers()).toBe(0);
	}, 120_000);
});
