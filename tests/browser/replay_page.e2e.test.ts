import { expect, test } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureBrowserBuild, launchBrowser, closeBrowser, runBunScript, startTestServer, waitFor } from "./browserHarness.ts";

test("external replay page controls an embedded replay without a gameplay socket", async () => {
	await ensureBrowserBuild();
	const directory = mkdtempSync(join(tmpdir(), "kore-replay-page-"));
	const dbPath = join(directory, "replay.db");
	const token = runBunScript("tests/browser/prepare_replay_fixture.ts", ["share", dbPath]);
	const server = await startTestServer({ dbPath });
	const browser = await launchBrowser();
	try {
		const page = await browser.newPage();
		const sockets: string[] = [];
		page.on("websocket", socket => sockets.push(socket.url()));
		await page.goto(`${server.url}/replay.html?replay=${token}`);
		await expect(page.locator("iframe")).toHaveAttribute("src", new RegExp(`replay=${token}.*embed=1`));
		await waitFor(async () => await page.locator("#status").textContent() === "Playback complete", 10_000, 50, "embedded replay ready");
		expect(await page.locator("#turn").textContent()).toBe("Turn 0 / 0");
		expect(sockets).toEqual([]);
	} finally {
		await closeBrowser(browser);
		await server.stop();
		rmSync(directory, { recursive: true, force: true });
	}
});
