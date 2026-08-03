import { expect, test } from "bun:test";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { DASHBOARD_DATABASE_PATH, DASHBOARD_LOGIN_PATH, DASHBOARD_LOGOUT_PATH, DASHBOARD_METRICS_PATH, DASHBOARD_PATH, dashboardUrl, metricsResponse, readDashboardConfig, serveDashboard } from "../src/server/dashboard.ts";

const secret = "0123456789abcdef0123456789abcdef";
const users = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
const request = (path: string, authorization?: string, method = "GET") => new Request(`https://operator.example${path}`, { method, headers: authorization ? { authorization } : {} });

test.serial("dashboard returns only versioned aggregate metrics and matching visible labels", async () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database);
	const response = (await serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret }))!;
	expect(response.status).toBe(200);
	expect(response.headers.get("cache-control")).toBe("no-store");
	expect(await response.json()).toMatchObject({
		schemaVersion: 1,
		counts: { allTime: 0, now: 0, paused: 0, sleeping: 0 },
		freshness: metricsResponse(registry.getMetrics()).freshness,
	});

	const page = await (await serveDashboard(request(DASHBOARD_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret }))!.text();
	expect(page).toContain('data-metric="allTime">0');
	expect(page).toContain("All-time matches");
	expect(page).toContain("Matches now");
	expect(page).toContain("Paused matches");
	expect(page).toContain("Sleeping matches");
	expect(page).not.toContain("snapshot");
	expect(page).not.toContain(users[0]);
	const jsonDashboard = (await serveDashboard(request(`${DASHBOARD_PATH}?format=json`, `Bearer ${secret}`), registry, { operatorSecret: secret }))!;
	expect(jsonDashboard.headers.get("content-type")).toContain("application/json");
	expect(await jsonDashboard.json()).toMatchObject({ schemaVersion: 1, counts: { allTime: 0, now: 0, paused: 0, sleeping: 0 } });
	database.close();
});

test.serial("dashboard counts remain server-derived across lifecycle changes", async () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database, 1);
	const record = registry.create(createDefaultGameSettings(2, 1), users);
	registry.setPaused(record.id, true, 10);
	let response = (await serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret }))!;
	expect(await response.json()).toMatchObject({ schemaVersion: 1, counts: { allTime: 1, now: 0, paused: 1, sleeping: 0 } });
	registry.setPaused(record.id, false, 11);
	registry.evictInactive(Date.now() + 2);
	response = (await serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret }))!;
	expect(await response.json()).toMatchObject({ counts: { allTime: 1, now: 0, paused: 0, sleeping: 1 } });
	registry.connectUser(users[0]);
	response = (await serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret }))!;
	expect(await response.json()).toMatchObject({ counts: { allTime: 1, now: 1, paused: 0, sleeping: 0 } });
	database.close();
});

test.serial("dashboard exposes durable map counts, percentages, and the most played map", async () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database);
	registry.create(createDefaultGameSettings(2, 1), users, "cue-clash");
	registry.create(createDefaultGameSettings(2, 1), ["33333333-3333-4333-8333-333333333333", "44444444-4444-4444-844444444444"], "cue-clash");
	registry.create(createDefaultGameSettings(2, 1), ["55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"], "ice-map-v1");
	const response = (await serveDashboard(request(`${DASHBOARD_PATH}?format=json`, `Bearer ${secret}`), registry, { operatorSecret: secret }))!;
	expect(await response.json()).toMatchObject({
		mostPlayedMap: { mapId: "cue-clash", games: 2, percentage: 66.67 },
		mapUsage: [
			{ mapId: "cue-clash", games: 2, percentage: 66.67 },
			{ mapId: "ice-map-v1", games: 1, percentage: 33.33 },
		],
	});
	const page = await (await serveDashboard(request(DASHBOARD_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret }))!.text();
	expect(page).toContain('data-metric="mostPlayedMap">cue-clash (2 games, 66.67%)');
	expect(page).toContain('data-metric="mapUsage"');
	database.close();
});

test("dashboard routes fail closed and never expose errors", async () => {
	let calls = 0;
	const registry = { getMetrics: () => { calls++; throw new Error("/private/kore.db secret"); } } as unknown as GameRegistry;
	const config = readDashboardConfig({ KORE_DASHBOARD_OPERATOR_SECRET: secret });
	const missing = (await serveDashboard(request(DASHBOARD_METRICS_PATH), registry, config))!;
	const wrong = (await serveDashboard(request(DASHBOARD_METRICS_PATH, "Bearer wrong"), registry, config))!;
	const disabled = (await serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, readDashboardConfig({})))!;
	expect([missing.status, wrong.status, disabled.status]).toEqual([404, 404, 404]);
	expect(calls).toBe(0);
	expect((await serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`, "POST"), registry, config))!.status).toBe(405);
	const unavailable = (await serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, config))!;
	expect(unavailable.status).toBe(503);
	expect(await unavailable.text()).toBe('{"error":"dashboard_unavailable"}');
	expect(await serveDashboard(request("/operator/unknown", `Bearer ${secret}`), registry, config)).toBeUndefined();
});

test("operator login creates an HttpOnly signed cookie accepted by dashboard routes", async () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database);
	const config = { operatorSecret: secret };
	const login = (await serveDashboard(new Request(`https://operator.example${DASHBOARD_LOGIN_PATH}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: secret }) }), registry, config))!;
	expect(login.status).toBe(200);
	const cookie = login.headers.get("set-cookie")!;
	expect(cookie).toContain("HttpOnly");
	expect(cookie).toContain("Secure");
	expect(cookie).toContain("SameSite=Strict");
	const dashboard = (await serveDashboard(request(DASHBOARD_PATH, undefined), registry, config))!;
	expect(dashboard.status).toBe(404);
	const cookieDashboard = (await serveDashboard(new Request(`https://operator.example${DASHBOARD_PATH}`, { headers: { cookie: cookie.split(";")[0]! } }), registry, config))!;
	expect(cookieDashboard.status).toBe(200);
	const logout = (await serveDashboard(new Request(`https://operator.example${DASHBOARD_LOGOUT_PATH}`, { method: "POST", headers: { cookie: cookie.split(";")[0]! } }), registry, config))!;
	expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
	const rejected = (await serveDashboard(new Request(`https://operator.example${DASHBOARD_LOGIN_PATH}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "wrong" }) }), registry, config))!;
	expect(rejected.status).toBe(404);
	database.close();
});

test("operator login serves a browser form and redirects after a form submission", async () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database);
	const config = { operatorSecret: secret };
	const publicBaseUrl = "https://operator.example/kore";
	const page = (await serveDashboard(new Request(`https://operator.example${DASHBOARD_LOGIN_PATH}`), registry, config, undefined, publicBaseUrl))!;
	expect(page.status).toBe(200);
	expect(await page.text()).toContain(`action="${publicBaseUrl}/operator/login"`);
	const form = new URLSearchParams({ password: secret });
	const login = (await serveDashboard(new Request(`https://operator.example${DASHBOARD_LOGIN_PATH}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html" }, body: form }), registry, config, undefined, publicBaseUrl))!;
	expect(login.status).toBe(303);
	expect(login.headers.get("location")).toBe(`${publicBaseUrl}/operator/dashboard`);
	expect(login.headers.get("set-cookie")).toContain("Path=/kore/operator");
	expect(login.headers.get("set-cookie")).toContain("HttpOnly");
	expect(dashboardUrl("https://operator.example/kore/?ignored=1", DASHBOARD_DATABASE_PATH)).toBe("https://operator.example/kore/operator/db");
	database.close();
});

test("database backup is available only through authenticated operator routing", async () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database);
	const config = { operatorSecret: secret };
	expect((await serveDashboard(request(DASHBOARD_DATABASE_PATH), registry, config, database))!.status).toBe(404);
	const backup = (await serveDashboard(request(DASHBOARD_DATABASE_PATH, `Bearer ${secret}`), registry, config, database))!;
	expect(backup.status).toBe(200);
	expect(backup.headers.get("content-type")).toBe("application/vnd.sqlite3");
	expect(backup.headers.get("content-disposition")).toContain("attachment");
	expect(new TextDecoder().decode((await backup.arrayBuffer()).slice(0, 16))).toBe("SQLite format 3\u0000");
	database.close();
});
