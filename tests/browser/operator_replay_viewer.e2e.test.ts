import { expect, test } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureBrowserBuild, launchBrowser, closeBrowser, nextTestPort, runBunScript, startTestServer, waitFor } from "./browserHarness.ts";

const secret = "operator-replay-viewer-secret-at-least-32-bytes";

test("operator View replay starts playback for an unfinished persisted match", async () => {
	await ensureBrowserBuild();
	const directory = mkdtempSync(join(tmpdir(), "kore-operator-replay-"));
	const dbPath = join(directory, "replay.db");
	// Authoritative match creation needs bun:sqlite, so it runs in the bun
	// fixture helper; the game id is printed to stdout.
	const gameId = runBunScript("tests/browser/prepare_replay_fixture.ts", ["operator", dbPath]);
	expect(gameId).toMatch(/^[a-f0-9-]{8,}$/);
	const port = nextTestPort();
	const server = await startTestServer({ port, dbPath, env: { KORE_BASE_URL: `http://localhost:${port}`, KORE_DASHBOARD_OPERATOR_SECRET: secret } });
	const browser = await launchBrowser();
	try {
		const response = await fetch(`${server.url}/operator/replays/${gameId}/view`, { headers: { authorization: `Bearer ${secret}` }, redirect: "manual" });
		expect(response.status).toBe(303);
		const location = response.headers.get("location")!;
		expect(location).toMatch(new RegExp(`^${server.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/\\?replay=[a-f0-9]{32}$`));
		const page = await browser.newPage();
		await page.goto(location);
		await waitFor(async () => await page.evaluate(() => (window as any).game?.handler?.getMouseHandler?.()?.getRuntime?.()?.toSettings?.().screens[0].elements.find((element: any) => element.id === "replay-status")?.text) === "Replay loaded. Playback is read-only.", 10_000, 50, "operator replay load");
		await waitFor(async () => await page.evaluate(() => (window as any).replayViewer?.getPlayer?.()?.getHandler?.().getState?.() === "GameState.Playing"), 10_000, 25, "operator replay playback start");
	} finally {
		await closeBrowser(browser);
		await server.stop();
		rmSync(directory, { recursive: true, force: true });
	}
});
