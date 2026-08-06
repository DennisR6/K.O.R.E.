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
		expect(await metrics.json()).toMatchObject({ schemaVersion: 1, counts: { allTime: 0, playersAllTime: 0, playersOnline: 0, now: 0, paused: 0, sleeping: 0 } });
		const page = await fetch(`${server.url}/operator/dashboard`, { headers: { authorization: `Bearer ${secret}` } });
		expect(page.status).toBe(200);
		expect(page.headers.get("cache-control")).toBe("no-store");
		expect(await page.text()).toContain('data-metric="allTime">0');
		const jsonDashboard = await fetch(`${server.url}/operator/dashboard?format=json`, { headers: { authorization: `Bearer ${secret}` } });
		expect(jsonDashboard.status).toBe(200);
		expect(jsonDashboard.headers.get("content-type")).toContain("application/json");
		expect(await jsonDashboard.json()).toMatchObject({ schemaVersion: 1, counts: { allTime: 0, playersAllTime: 0, playersOnline: 0, now: 0, paused: 0, sleeping: 0 } });
		expect((await fetch(`${server.url}/operator/replays?format=json`)).status).toBe(404);
		const replays = await fetch(`${server.url}/operator/replays?format=json`, { headers: { authorization: `Bearer ${secret}` } });
		expect(replays.status).toBe(200);
		expect(await replays.json()).toEqual({ schemaVersion: 1, replays: [], filter: {} });
		const login = await fetch(`${server.url}/operator/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: secret }) });
		expect(login.status).toBe(200);
		const cookie = login.headers.get("set-cookie")!;
		expect(cookie).toContain("HttpOnly");
		const cookieDashboard = await fetch(`${server.url}/operator/dashboard?format=json`, { headers: { cookie: cookie.split(";")[0]! } });
		expect(cookieDashboard.status).toBe(200);
		const backup = await fetch(`${server.url}/operator/db`, { headers: { cookie: cookie.split(";")[0]! } });
		expect(backup.status).toBe(200);
		expect(backup.headers.get("content-disposition")).toContain("kore-backup.sqlite3");
		expect(new TextDecoder().decode((await backup.arrayBuffer()).slice(0, 16))).toBe("SQLite format 3\u0000");
		expect((await fetch(`${server.url}/operator/dashboard`, { method: "POST", headers: { authorization: `Bearer ${secret}` } })).status).toBe(405);
		expect((await fetch(`${server.url}/src/server/dashboard.ts`)).status).toBe(404);
	} finally {
		await server.stop();
	}
}, 30_000);
