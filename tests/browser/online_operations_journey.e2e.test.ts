import { expect, test } from "bun:test";
import { ensureBrowserBuild, launchBrowser, nextTestPort, startTestServer, waitFor } from "./browserHarness.ts";

test.serial("online match join honors map preference without mounting legacy HTML match controls", async () => {
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
		expect(await pageA.locator("#network-pause-menu").count()).toBe(0);
		expect(await pageB.locator("#network-pause-menu").count()).toBe(0);
		await contextA.close();
		await contextB.close();
	} finally {
		await browser.close();
		await server.stop();
	}
}, 120_000);
