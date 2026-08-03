import { expect, test } from "bun:test";
import { ensureBrowserBuild, launchBrowser, nextTestPort, startTestServer, waitFor } from "./browserHarness.ts";

test.serial("online operations join honors map preference and pauses only after both players agree", async () => {
	await ensureBrowserBuild();
	const port = nextTestPort();
	const secret = "section-20-dashboard-secret-with-at-least-32-bytes";
	const server = await startTestServer({ port, env: { KORE_BASE_URL: `http://localhost:${port}`, KORE_DASHBOARD_OPERATOR_SECRET: secret } });
	const browser = await launchBrowser();
	try {
		const unauthorized = await fetch(`${server.url}/operator/dashboard/metrics`);
		expect(unauthorized.status).toBe(404);
		const metrics = await fetch(`${server.url}/operator/dashboard/metrics`, { headers: { authorization: `Bearer ${secret}` } });
		expect(metrics.status).toBe(200);
		expect((await metrics.json() as { counts: { allTime: number } }).counts.allTime).toBe(0);

		const join = `${server.url}/?skipmenu=1&url=${encodeURIComponent(`ws://localhost:${port}/`)}&map=cue-clash`;
		const contextA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const contextB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const pageA = await contextA.newPage();
		const pageB = await contextB.newPage();
		await pageA.goto(join);
		await pageB.goto(join);
		const mode = (page: typeof pageA) => page.evaluate(() => (window as any).game?.handler?.getSettings?.()?.gameMode?.id ?? null);
		await waitFor(async () => (await mode(pageA)) !== null && (await mode(pageB)) !== null, 20_000, 100, "matched online game");
		expect(await pageA.locator("#network-pause-menu").count()).toBe(1);
		expect(await pageB.locator("#network-pause-menu").count()).toBe(1);

		const pauseA = pageA.locator("#network-pause-menu button").first();
		const pauseB = pageB.locator("#network-pause-menu button").first();
		await pauseA.evaluate((button: HTMLButtonElement) => button.click());
		await waitFor(async () => (await pageA.locator("#network-pause-menu p").textContent())?.includes("Waiting") ?? false, 10_000, 50, "first pause request");
		await pauseB.evaluate((button: HTMLButtonElement) => button.click());
		await waitFor(async () => (await pageA.locator("#network-pause-menu p").textContent()) === "Match paused", 10_000, 50, "authoritative pause");
		await waitFor(async () => (await pageB.locator("#network-pause-menu p").textContent()) === "Match paused", 10_000, 50, "authoritative pause broadcast");
		await contextA.close();
		await contextB.close();
	} finally {
		await browser.close();
		await server.stop();
	}
}, 120_000);
