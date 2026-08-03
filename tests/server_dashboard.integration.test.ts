import { expect, test } from "bun:test";
import { nextTestPort, startTestServer } from "./browser/browserHarness.ts";

const secret = "0123456789abcdef0123456789abcdef";

test.serial("production server exposes only authenticated aggregate dashboard routes", async () => {
	const server = await startTestServer({ port: nextTestPort(), env: { KORE_DASHBOARD_OPERATOR_SECRET: secret } });
	try {
		const unauthenticated = await fetch(`${server.url}/operator/dashboard/metrics`);
		expect(unauthenticated.status).toBe(404);
		const metrics = await fetch(`${server.url}/operator/dashboard/metrics`, { headers: { authorization: `Bearer ${secret}` } });
		expect(metrics.status).toBe(200);
		expect(metrics.headers.get("cache-control")).toBe("no-store");
		expect(await metrics.json()).toMatchObject({ schemaVersion: 1, counts: { allTime: 0, now: 0, paused: 0, sleeping: 0 } });
		const page = await fetch(`${server.url}/operator/dashboard`, { headers: { authorization: `Bearer ${secret}` } });
		expect(page.status).toBe(200);
		expect(page.headers.get("cache-control")).toBe("no-store");
		expect(await page.text()).toContain('data-metric="allTime">0');
		const jsonDashboard = await fetch(`${server.url}/operator/dashboard?format=json`, { headers: { authorization: `Bearer ${secret}` } });
		expect(jsonDashboard.status).toBe(200);
		expect(jsonDashboard.headers.get("content-type")).toContain("application/json");
		expect(await jsonDashboard.json()).toMatchObject({ schemaVersion: 1, counts: { allTime: 0, now: 0, paused: 0, sleeping: 0 } });
		expect((await fetch(`${server.url}/operator/dashboard`, { method: "POST", headers: { authorization: `Bearer ${secret}` } })).status).toBe(405);
		expect((await fetch(`${server.url}/src/server/dashboard.ts`)).status).toBe(404);
	} finally {
		await server.stop();
	}
}, 30_000);
