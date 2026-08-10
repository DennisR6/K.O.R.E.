import { expect, test } from "bun:test";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { DASHBOARD_DATABASE_PATH, DASHBOARD_LOGIN_PATH, DASHBOARD_LOGOUT_PATH, DASHBOARD_METRICS_PATH, DASHBOARD_PATH, DASHBOARD_REPLAYS_PATH, dashboardUrl, metricsResponse, readDashboardConfig, serveDashboard } from "../src/server/dashboard.ts";
import { servePublicReplayShare } from "../src/server/replayShares.ts";
import { ReplayViewer } from "../src/menu/replayViewer.ts";
import { ReplayRecorder } from "../src/replay/recorder.ts";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.ts";
import { MatchEndReason, MatchStatus } from "../src/rules/types.ts";

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
		counts: { allTime: 0, playersAllTime: 0, playersOnline: 0, now: 0, paused: 0, sleeping: 0 },
		freshness: metricsResponse(registry.getMetrics()).freshness,
	});

	const page = await (await serveDashboard(request(DASHBOARD_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret }))!.text();
	expect(page).toContain('data-metric="allTime">0');
	expect(page).toContain("All-time matches");
	expect(page).toContain("All-time players");
	expect(page).toContain("Players online");
	expect(page).toContain("Matches now");
	expect(page).toContain("Paused matches");
	expect(page).toContain("Sleeping matches");
	expect(page).toContain("https://cdn.tailwindcss.com");
	expect(page).toContain("https://unpkg.com/htmx.org@2.0.4");
	expect(page).toContain('hx-trigger="every 60s"');
	expect(page).toContain('hx-select="#dashboard-live"');
	expect(page).toContain("Latency comparison");
	expect(page).toContain('data-period="today"');
	expect(page).toContain('data-period="yesterday"');
	expect(page).toContain('data-period="week"');
	expect(page).toContain('id="latency-median"');
	expect(page).toContain("No data");
	expect(page).not.toContain("snapshot");
	expect(page).not.toContain(users[0]);
	const mountedPage = await (await serveDashboard(request(DASHBOARD_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret }, database, "https://operator.example/kore"))!.text();
	expect(mountedPage).toContain('href="https://operator.example/kore/operator/replays"');
	expect(mountedPage).toContain('href="https://operator.example/kore/operator/db"');
	const jsonDashboard = (await serveDashboard(request(`${DASHBOARD_PATH}?format=json`, `Bearer ${secret}`), registry, { operatorSecret: secret }))!;
	expect(jsonDashboard.headers.get("content-type")).toContain("application/json");
	expect(await jsonDashboard.json()).toMatchObject({ schemaVersion: 1, counts: { allTime: 0, playersAllTime: 0, playersOnline: 0, now: 0, paused: 0, sleeping: 0 } });
	database.close();
});

test.serial("dashboard counts remain server-derived across lifecycle changes", async () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database, 1);
	const record = registry.create(createDefaultGameSettings(2, 1), users);
	registry.setPaused(record.id, true, 10);
	let response = (await serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret }))!;
	expect(await response.json()).toMatchObject({ schemaVersion: 1, counts: { allTime: 1, playersAllTime: 2, playersOnline: 0, now: 0, paused: 1, sleeping: 0 } });
	registry.setPaused(record.id, false, 11);
	registry.evictInactive(Date.now() + 2);
	response = (await serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret }))!;
	expect(await response.json()).toMatchObject({ counts: { allTime: 1, playersAllTime: 2, playersOnline: 0, now: 0, paused: 0, sleeping: 1 } });
	registry.connectUser(users[0]);
	response = (await serveDashboard(request(DASHBOARD_METRICS_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret }))!;
	expect(await response.json()).toMatchObject({ counts: { allTime: 1, playersAllTime: 2, playersOnline: 1, now: 1, paused: 0, sleeping: 0 } });
	database.close();
});

test.serial("dashboard exposes durable map counts, percentages, and the most played map", async () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database);
	registry.create(createDefaultGameSettings(2, 1), users, "cue-clash");
	registry.create(createDefaultGameSettings(2, 1), ["33333333-3333-4333-8333-333333333333", "44444444-4444-4444-844444444444"], "cue-clash");
	registry.create(createDefaultGameSettings(2, 1), ["55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"], "ice-map-v1");
	const response = (await serveDashboard(request(`${DASHBOARD_PATH}?format=json`, `Bearer ${secret}`), registry, { operatorSecret: secret }, database))!;
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

test.serial("dashboard includes production offline and AI match reports", async () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database);
	const replay = new ReplayRecorder(createCanonicalPlayableMatchSettings(), 123).getReplay();
	const offline = database.storeOfflineMatch({
		mode: "ai-battle",
		mapId: "cue-clash",
		seed: 123,
		players: ["easy KI", "hard KI"],
		result: { status: MatchStatus.Winner, winnerTeam: 0, reason: MatchEndReason.LastTeamStanding, turnNumber: 4 },
		replay,
		performanceLogs: [
			{ type: "turn.completed", timestampMs: 1, turnNumber: 1, data: { durationMs: 5 } },
			{ type: "turn.completed", timestampMs: 2, turnNumber: 2, data: { durationMs: 10 } },
		],
	});
	const playerOffline = database.storeOfflineMatch({
		mode: "hotseat",
		mapId: "cue-clash",
		seed: 124,
		players: ["Player 1", "Player 2"],
		result: { status: MatchStatus.Draw, winnerTeam: null, reason: MatchEndReason.Draw, turnNumber: 4 },
		replay: new ReplayRecorder(createCanonicalPlayableMatchSettings(), 124).getReplay(),
	});
	const offlineIndex = (await serveDashboard(request(`${DASHBOARD_REPLAYS_PATH}?format=json`, `Bearer ${secret}`), registry, { operatorSecret: secret }, database))!;
	expect((await offlineIndex.json() as { replays: Array<{ gameId: string; gameType: string; status: string; updatedAt: number; actionCount: number }> }).replays).toEqual(expect.arrayContaining([
		{ gameId: offline.id, gameType: "ai", status: "completed", updatedAt: offline.createdAt, actionCount: 0 },
		{ gameId: playerOffline.id, gameType: "player", status: "completed", updatedAt: playerOffline.createdAt, actionCount: 0 },
	]));
	const offlineView = (await serveDashboard(request(`${DASHBOARD_REPLAYS_PATH}/${offline.id}/view`, `Bearer ${secret}`), registry, { operatorSecret: secret }, database))!;
	expect(offlineView.status).toBe(303);
	const response = (await serveDashboard(request(`${DASHBOARD_PATH}?format=json`, `Bearer ${secret}`), registry, { operatorSecret: secret }, database))!;
	expect(await response.json()).toMatchObject({
		counts: { allTime: 2, offlineMatches: 2, playersAllTime: 4 },
		offlineModes: [{ mode: "ai-battle", games: 1 }, { mode: "hotseat", games: 1 }],
		mapUsage: [{ mapId: "cue-clash", games: 2, percentage: 100 }],
		performance: { today: { samples: 2, median: 5, p90: 10, average: 7.5, max: 10 } },
	});
	const page = await (await serveDashboard(request(DASHBOARD_PATH, `Bearer ${secret}`), registry, { operatorSecret: secret }, database)).text();
	expect(page).toContain('data-metric="offlineMatches">2');
	expect(page).toContain("Offline / KI breakdown");
	expect(page).toContain("AI vs AI");
	database.close();
});

test.serial("authenticated dashboard lists every persisted replay and filters/downloads by match ID", async () => {
	const database = new GameDatabase(":memory:");
	const registry = new GameRegistry(database);
	const first = registry.create(createDefaultGameSettings(2, 1), users, "cue-clash");
	const second = registry.create(createDefaultGameSettings(2, 1), ["33333333-3333-4333-8333-333333333333", "44444444-4444-4444-844444444444"], "ice-map-v1");
	const completedSettings = createDefaultGameSettings(2, 1);
	completedSettings.players.find(player => player.team.includes(1))!.isDead = true;
	const completed = registry.create(completedSettings, ["55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"]);
	const actorId = completed.handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!.getId();
	expect(registry.submitTurn(completed.users[0]!, { actorId, angle: 0, power: 1 }).ok).toBe(true);
	const unauthorized = (await serveDashboard(request(`${DASHBOARD_REPLAYS_PATH}?format=json`), registry, { operatorSecret: secret }, database))!;
	expect(unauthorized.status).toBe(404);
	const index = (await serveDashboard(request(`${DASHBOARD_REPLAYS_PATH}?format=json`, `Bearer ${secret}`), registry, { operatorSecret: secret }, database))!;
	expect(index.status).toBe(200);
	const indexBody = await index.json() as { schemaVersion: number; filter: object; replays: Array<{ gameId: string; gameType: string; actionCount: number }> };
	expect(indexBody.schemaVersion).toBe(1);
	expect(indexBody.filter).toEqual({});
	expect(indexBody.replays.map(replay => ({ gameId: replay.gameId, gameType: replay.gameType, actionCount: replay.actionCount })).sort((left, right) => left.gameId.localeCompare(right.gameId))).toEqual([{ gameId: first.id, gameType: "player", actionCount: 0 }, { gameId: second.id, gameType: "player", actionCount: 0 }, { gameId: completed.id, gameType: "player", actionCount: 1 }].sort((left, right) => left.gameId.localeCompare(right.gameId)));
	const filtered = (await serveDashboard(request(`${DASHBOARD_REPLAYS_PATH}?format=json&id=${encodeURIComponent(first.id)}`, `Bearer ${secret}`), registry, { operatorSecret: secret }, database))!;
	expect(await filtered.json()).toMatchObject({ filter: { gameId: first.id }, replays: [{ gameId: first.id }] });
	const page = (await serveDashboard(request(`${DASHBOARD_REPLAYS_PATH}?id=${encodeURIComponent(first.id)}`, `Bearer ${secret}`), registry, { operatorSecret: secret }, database))!;
	const pageHtml = await page.text();
	expect(pageHtml).toContain(`data-replays="index"`);
	expect(pageHtml).toContain('hx-trigger="input changed delay:500ms"');
	expect(pageHtml).toContain(">Type<");
	expect(pageHtml).toContain("Kill game");
	const kill = (await serveDashboard(request(`${DASHBOARD_REPLAYS_PATH}/${encodeURIComponent(first.id)}/kill`, `Bearer ${secret}`, "POST"), registry, { operatorSecret: secret }, database))!;
	expect(kill.status).toBe(303);
	expect(registry.get(first.id)?.lifecycle.status).toBe("completed");
	expect(registry.get(first.id)?.handler.getMatchResult()?.status).toBe(MatchStatus.Draw);
	expect((await serveDashboard(request(`${DASHBOARD_REPLAYS_PATH}/${encodeURIComponent(first.id)}/kill`, `Bearer ${secret}`, "POST"), registry, { operatorSecret: secret }, database))!.status).toBe(404);
	expect(pageHtml).toContain('hx-target="#replay-table"');
	const htmxSearch = (await serveDashboard(new Request(`https://operator.example${DASHBOARD_REPLAYS_PATH}?id=${encodeURIComponent(first.id)}`, { headers: { authorization: `Bearer ${secret}`, "HX-Request": "true" } }), registry, { operatorSecret: secret }, database))!;
	expect(htmxSearch.headers.get("content-type")).toContain("text/html");
	const firstSummary = database.listOperatorReplays(first.id)[0]!;
	const htmxHtml = await htmxSearch.text();
	expect(htmxHtml).toContain('id="replay-table"');
	expect(htmxHtml).toContain('class="w-full min-w-[820px] text-left"');
	expect(htmxHtml).toContain(`>${firstSummary.gameType}<`);
	expect(htmxHtml).toContain(`>${firstSummary.status}<`);
	expect(htmxHtml).toContain(`href="/operator/replays/${first.id}/view"`);
	expect(htmxHtml).toContain('target="_blank" rel="noopener noreferrer"');
	const completedPage = (await serveDashboard(request(`${DASHBOARD_REPLAYS_PATH}?id=${encodeURIComponent(completed.id)}`, `Bearer ${secret}`), registry, { operatorSecret: secret }, database))!;
	const completedHtml = await completedPage.text();
	expect(completedHtml).toContain("View replay");
	expect(completedHtml).toContain('hx-target="#replay-table"');
	expect(completedHtml).toContain('id="replay-table"');
	expect(completedHtml).toContain(`${DASHBOARD_REPLAYS_PATH}/${completed.id}/view`);
	expect(completedHtml).toContain(`${DASHBOARD_REPLAYS_PATH}/${completed.id}`);
	const mountedPage = (await serveDashboard(request(`${DASHBOARD_REPLAYS_PATH}?id=${encodeURIComponent(first.id)}`, `Bearer ${secret}`), registry, { operatorSecret: secret }, database, "https://operator.example/kore"))!;
	const mountedHtml = await mountedPage.text();
	expect(mountedHtml).toContain(`href="https://operator.example/kore/operator/replays/${first.id}/view"`);
	expect(mountedHtml).toContain(`href="https://operator.example/kore/operator/replays/${first.id}"`);
	const download = (await serveDashboard(request(`${DASHBOARD_REPLAYS_PATH}/${encodeURIComponent(first.id)}`, `Bearer ${secret}`), registry, { operatorSecret: secret }, database))!;
	expect(download.status).toBe(200);
	expect(download.headers.get("content-disposition")).toContain("attachment");
	expect(await download.json()).toMatchObject({ schemaVersion: 1, actions: [] });
	const activeView = (await serveDashboard(request(`${DASHBOARD_REPLAYS_PATH}/${encodeURIComponent(first.id)}/view`, `Bearer ${secret}`), registry, { operatorSecret: secret }, database))!;
	expect(activeView.status).toBe(303);
	const viewUrl = activeView.headers.get("location")!;
	const viewToken = new URL(viewUrl, "https://operator.example").searchParams.get("replay")!;
	const publicView = servePublicReplayShare(new Request(`https://operator.example/replays/${viewToken}`), registry)!;
	expect(publicView.status).toBe(200);
	const viewer = new ReplayViewer();
	expect(viewer.loadReplay((await publicView.json() as { replay: unknown }).replay)).toBe(true);
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
