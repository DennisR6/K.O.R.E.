import { expect, test } from "bun:test";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { DASHBOARD_METRICS_PATH, DASHBOARD_PATH, metricsResponse, readDashboardConfig, serveDashboard } from "../src/server/dashboard.ts";

const secret = "0123456789abcdef0123456789abcdef";
const users = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
const request = (path: string, authorization?: string, method = "GET") => new Request(`https://operator.example${path}`, { method, headers: authorization ? { authorization } : {} });

test.serial("dashboard returns only versioned aggregate metrics and matching visible labels", async () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database);
	const response = serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret })!;
	expect(response.status).toBe(200);
	expect(response.headers.get("cache-control")).toBe("no-store");
	expect(await response.json()).toMatchObject({
		schemaVersion: 1,
		counts: { allTime: 0, now: 0, paused: 0, sleeping: 0 },
		freshness: metricsResponse(registry.getMetrics()).freshness,
	});

	const page = await serveDashboard(request(DASHBOARD_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret })!.text();
	expect(page).toContain('data-metric="allTime">0');
	expect(page).toContain("All-time matches");
	expect(page).toContain("Matches now");
	expect(page).toContain("Paused matches");
	expect(page).toContain("Sleeping matches");
	expect(page).not.toContain("snapshot");
	expect(page).not.toContain(users[0]);
	const jsonDashboard = serveDashboard(request(`${DASHBOARD_PATH}?format=json`, `Bearer ${secret}`), registry, { operatorSecret: secret })!;
	expect(jsonDashboard.headers.get("content-type")).toContain("application/json");
	expect(await jsonDashboard.json()).toMatchObject({ schemaVersion: 1, counts: { allTime: 0, now: 0, paused: 0, sleeping: 0 } });
	database.close();
});

test.serial("dashboard counts remain server-derived across lifecycle changes", async () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database, 1);
	const record = registry.create(createDefaultGameSettings(2, 1), users);
	registry.setPaused(record.id, true, 10);
	let response = serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret })!;
	expect(await response.json()).toMatchObject({ schemaVersion: 1, counts: { allTime: 1, now: 0, paused: 1, sleeping: 0 } });
	registry.setPaused(record.id, false, 11);
	registry.evictInactive(Date.now() + 2);
	response = serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret })!;
	expect(await response.json()).toMatchObject({ counts: { allTime: 1, now: 0, paused: 0, sleeping: 1 } });
	registry.connectUser(users[0]);
	response = serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret })!;
	expect(await response.json()).toMatchObject({ counts: { allTime: 1, now: 1, paused: 0, sleeping: 0 } });
	database.close();
});

test("dashboard routes fail closed and never expose errors", async () => {
	let calls = 0;
	const registry = { getMetrics: () => { calls++; throw new Error("/private/kore.db secret"); } } as unknown as GameRegistry;
	const config = readDashboardConfig({ KORE_DASHBOARD_OPERATOR_SECRET: secret });
	const missing = serveDashboard(request(DASHBOARD_METRICS_PATH), registry, config)!;
	const wrong = serveDashboard(request(DASHBOARD_METRICS_PATH, "Bearer wrong"), registry, config)!;
	const disabled = serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, readDashboardConfig({}))!;
	expect([missing.status, wrong.status, disabled.status]).toEqual([404, 404, 404]);
	expect(calls).toBe(0);
	expect(serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`, "POST"), registry, config)!.status).toBe(405);
	const unavailable = serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, config)!;
	expect(unavailable.status).toBe(503);
	expect(await unavailable.text()).toBe('{"error":"dashboard_unavailable"}');
	expect(serveDashboard(request("/operator/unknown", `Bearer ${secret}`), registry, config)).toBeUndefined();
});
