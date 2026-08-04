import { afterAll, describe, expect, test } from "bun:test";
import {
	activeBrowserServers,
	assertCleanConsole,
	captureConsole,
	canvasGeometry,
	clickWorld,
	ensureBrowserBuild,
	launchBrowser,
	startTestServer,
	waitFor,
} from "./browserHarness.ts";

describe("generic UI SDK browser debug sandbox", () => {
	afterAll(() => expect(activeBrowserServers()).toBe(0));

	test("debug=ui runs the standalone SDK sandbox and preserves state through reconstruction", async () => {
		await ensureBrowserBuild();
		const server = await startTestServer();
		const browser = await launchBrowser();
		try {
			const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
			const capture = captureConsole(page);
			const response = await page.goto(`${server.url}/?debug=ui`, { waitUntil: "load" });
			expect(response?.status()).toBe(200);
			await waitFor(async () => (await canvasGeometry(page)).width > 0, 10_000, 100, "debug sandbox canvas");
			await waitFor(async () => await page.evaluate(() => (window as any).uiDebugSandbox?.getSettings?.().activeScreen === "overview"), 10_000, 100, "debug sandbox runtime");
			expect(await page.evaluate(() => (window as any).game ?? null)).toBeNull();

			await clickWorld(page, 40, 142); // Overview -> Text
			await waitFor(async () => await page.evaluate(() => (window as any).uiDebugSandbox.getSettings().activeScreen === "text"), 5_000, 50, "text screen");
			await clickWorld(page, 30, 100);
			await page.locator("canvas").focus();
			await page.keyboard.type("Ada Lovelace", { delay: 20 });
			await clickWorld(page, 350, 140);
			await waitFor(async () => String((await page.evaluate(() => (window as any).uiDebugSandbox.getDiagnostics().latestCommand))).includes("debug-form-submit"), 5_000, 50, "form command");

			await clickWorld(page, 200, 410); // navigation State
			await waitFor(async () => await page.evaluate(() => (window as any).uiDebugSandbox.getSettings().activeScreen === "state"), 5_000, 50, "state screen");
			await clickWorld(page, 30, 90);
			await page.locator("canvas").focus();
			await page.keyboard.type(" + persisted", { delay: 20 });
			await waitFor(async () => String((await page.evaluate(() => (window as any).uiDebugSandbox.getSettings().screens.find((screen: any) => screen.id === "state").elements.find((element: any) => element.id === "state-value").text))).includes("persisted"), 5_000, 50, "state text input");
			await clickWorld(page, 430, 145); // reconstruct
			await waitFor(async () => String((await page.evaluate(() => (window as any).uiDebugSandbox.getDiagnostics().reconstruction))).includes("equivalent"), 5_000, 50, "reconstructed runtime");
			const state = await page.evaluate(() => (window as any).uiDebugSandbox.getSettings());
			expect(state.activeScreen).toBe("state");
			expect(state.screens.find((screen: any) => screen.id === "state").elements.find((element: any) => element.id === "state-value").text).toContain("persisted");
			assertCleanConsole(capture);
		} finally {
			await browser.close();
			await server.stop();
		}
		expect(activeBrowserServers()).toBe(0);
	}, 120_000);
});
