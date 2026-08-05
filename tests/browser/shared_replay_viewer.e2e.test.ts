import { expect, test } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureBrowserBuild, launchBrowser, closeBrowser, runBunScript, startTestServer, waitFor } from "./browserHarness.ts";

test("shared replay viewer loads by URL and manual token without opening a gameplay socket", async () => {
	await ensureBrowserBuild();
	const directory = mkdtempSync(join(tmpdir(), "kore-replay-viewer-"));
	const dbPath = join(directory, "replay.db");
	// Persisting the completed match and its frozen replay share needs
	// bun:sqlite, so it runs in the bun fixture helper; the token is printed
	// to stdout.
	const token = runBunScript("tests/browser/prepare_replay_fixture.ts", ["share", dbPath]);
	expect(token).toMatch(/^[a-f0-9]{32}$/);
	const server = await startTestServer({ dbPath });
	const browser = await launchBrowser();
	try {
		const page = await browser.newPage();
		await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText: async () => { throw new DOMException("denied", "NotAllowedError"); } } }));
		const sockets: string[] = [];
		page.on("websocket", socket => sockets.push(socket.url()));
		await page.goto(`${server.url}/?replay=${token}`);
		await waitFor(async () => {
			const text = await page.locator("#replay-viewer-controls [role=status]").textContent();
			if (text?.includes("unavailable")) throw new Error(`direct replay load failed: ${text}`);
			const error = await page.evaluate(() => (window as any).replayViewer?.getErrorState?.());
			if (error) throw new Error(`direct replay decode failed: ${error}`);
			return text === "Replay loaded. No actions have been recorded yet.";
		}, 10_000, 50, "direct replay load");
		expect(sockets).toEqual([]);
		const input = page.locator("#replay-viewer-controls input");
		await input.fill(token);
		await page.getByRole("button", { name: "Load replay" }).evaluate((button: HTMLButtonElement) => button.click());
		await waitFor(async () => await page.locator("#replay-viewer-controls [role=status]").textContent() === "Replay loaded. No actions have been recorded yet.", 10_000, 50, "manual replay load");
		await page.getByRole("button", { name: "Paste from clipboard" }).evaluate((button: HTMLButtonElement) => button.click());
		await waitFor(async () => (await page.locator("#replay-viewer-controls [role=status]").textContent())?.includes("Clipboard access was denied") ?? false, 10_000, 50, "clipboard denial recovery");
		await input.fill("bad");
		await page.getByRole("button", { name: "Load replay" }).evaluate((button: HTMLButtonElement) => button.click());
		expect(await page.locator("#replay-viewer-controls [role=status]").textContent()).toBe("Enter a valid replay share ID.");
	} finally {
		await closeBrowser(browser);
		await server.stop();
		rmSync(directory, { recursive: true, force: true });
	}
});
