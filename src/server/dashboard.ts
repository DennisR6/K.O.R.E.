import { createHmac, timingSafeEqual } from "node:crypto";
import type { DashboardPerformanceMetrics, DashboardPerformanceTrendPoint, GameDatabase, OperatorReplaySummary, StoredFeedback } from "./db.js";
import type { FeedbackSubmission } from "./feedback.js";
import { validateFeedbackSubmission } from "./feedback.js";
import type { GameRegistry } from "./gameRegistry.js";
import type { MatchMetrics } from "./types.js";

export const DASHBOARD_METRICS_PATH = "/operator/dashboard/metrics";
export const DASHBOARD_PATH = "/operator/dashboard";
export const DASHBOARD_LOGIN_PATH = "/operator/login";
export const DASHBOARD_LOGOUT_PATH = "/operator/logout";
export const DASHBOARD_DATABASE_PATH = "/operator/db";
export const DASHBOARD_API_TOKENS_PATH = "/operator/api-tokens";
export const DASHBOARD_API_KEYS_PATH = "/operator/api-keys";
export const DASHBOARD_DEBUG_ASSET_KEYS_PATH = "/operator/debug-asset-keys";
export const DASHBOARD_FEEDBACK_PATH = "/operator/dashboard/feedback";
export const DASHBOARD_REPLAYS_PATH = "/operator/replays";
const DASHBOARD_COOKIE = "kore_operator_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const FRESHNESS = "allTime, offlineMatches, playersAllTime, and map usage include durable online and production-reported offline/KI matches; playersOnline, paused, and sleeping describe authoritative online matches; now is scoped to this server process's resident registry cache.";

export type DashboardConfig = { operatorSecret: string | undefined };

export type DashboardMetricsResponse = {
	schemaVersion: 1;
	measuredAt: number;
	counts: Pick<MatchMetrics, "allTime" | "offlineMatches" | "playtestMatches" | "playersAllTime" | "playersOnline" | "now" | "paused" | "sleeping">;
	offlineModes: MatchMetrics["offlineModes"];
	performance: DashboardPerformanceMetrics;
	feedback: StoredFeedback[];
	playtest: { matches: number; feedback: number; averageRating: number | null; topics: Record<string, number> };
	mapUsage: MatchMetrics["mapUsage"];
	mostPlayedMap: MatchMetrics["mostPlayedMap"];
	freshness: typeof FRESHNESS;
};
export type DashboardReplayIndexResponse = { schemaVersion: 1; replays: OperatorReplaySummary[]; filter: { gameId?: string } };

/** Reads a deployment-only secret; unset or weak values deliberately disable routes. */
export function readDashboardConfig(env: Record<string, string | undefined> = process.env): DashboardConfig {
	const secret = env.KORE_DASHBOARD_OPERATOR_SECRET;
	return { operatorSecret: typeof secret === "string" && Buffer.byteLength(secret) >= 32 ? secret : undefined };
}

export function isDashboardPath(pathname: string): boolean {
	return pathname === DASHBOARD_PATH || pathname === DASHBOARD_METRICS_PATH || pathname === DASHBOARD_LOGIN_PATH || pathname === DASHBOARD_LOGOUT_PATH || pathname === DASHBOARD_DATABASE_PATH || pathname === DASHBOARD_API_TOKENS_PATH || pathname === DASHBOARD_API_KEYS_PATH || pathname === DASHBOARD_DEBUG_ASSET_KEYS_PATH || pathname === DASHBOARD_FEEDBACK_PATH || pathname === DASHBOARD_REPLAYS_PATH || pathname.startsWith(`${DASHBOARD_API_TOKENS_PATH}/`) || pathname.startsWith(`${DASHBOARD_API_KEYS_PATH}/`) || pathname.startsWith(`${DASHBOARD_REPLAYS_PATH}/`);
}

/**
 * Handles the two exact operator routes. `/operator/dashboard?format=json`
 * serves the complete dashboard payload as JSON while retaining the same
 * authentication and no-store policy as the HTML representation. Undefined means the caller should
 * continue normal routing; disabled or unauthorized dashboard paths are an
 * indistinguishable not-found response to avoid endpoint discovery.
 */
export async function serveDashboard(request: Request, registry: Pick<GameRegistry, "getMetrics" | "killGame">, config: DashboardConfig, database?: Pick<GameDatabase, "exportSnapshot" | "listOperatorReplays" | "getOperatorReplay" | "createOperatorReplayView" | "getDashboardPerformanceMetrics" | "listFeedback" | "storeFeedback" | "createDashboardApiToken" | "listDashboardApiTokens" | "revokeDashboardApiToken" | "isDashboardApiTokenValid" | "createDebugAssetToken" | "listDebugAssetTokens" | "revokeDebugAssetToken">, publicBaseUrl?: string): Promise<Response | undefined> {
	const url = new URL(request.url); const pathname = url.pathname;
	if (!isDashboardPath(pathname)) return undefined;
	if (pathname === DASHBOARD_LOGIN_PATH) return login(request, config.operatorSecret, publicBaseUrl);
	if (pathname === DASHBOARD_LOGOUT_PATH) return logout(request, config.operatorSecret, publicBaseUrl);
	const apiTokenAccess = database && (pathname === DASHBOARD_METRICS_PATH || pathname === DASHBOARD_DATABASE_PATH) && isBearerApiToken(request, database);
	if (!isAuthorized(request, config.operatorSecret) && !apiTokenAccess) return notFound();
	if (pathname === DASHBOARD_DATABASE_PATH) return databaseDownload(request, database);
	if (pathname === DASHBOARD_API_TOKENS_PATH || pathname.startsWith(`${DASHBOARD_API_TOKENS_PATH}/`) || pathname === DASHBOARD_API_KEYS_PATH || pathname.startsWith(`${DASHBOARD_API_KEYS_PATH}/`)) return apiTokens(request, database, pathname);
	if (pathname === DASHBOARD_DEBUG_ASSET_KEYS_PATH) return debugAssetTokens(request, database);
	if (pathname === DASHBOARD_FEEDBACK_PATH) return operatorFeedback(request, database);
	if (pathname === DASHBOARD_REPLAYS_PATH || pathname.startsWith(`${DASHBOARD_REPLAYS_PATH}/`)) return operatorReplays(request, registry, database, pathname, url.searchParams.get("id"), publicBaseUrl);
	if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { allow: "GET", "cache-control": "no-store" } });
	try {
		const metrics = registry.getMetrics();
		const body = metricsResponse(metrics, database?.getDashboardPerformanceMetrics(), database?.listFeedback() ?? []);
		if (pathname === DASHBOARD_METRICS_PATH || wantsJson(request)) {
			return Response.json(body, { headers: { "cache-control": "no-store" } });
		}
		return new Response(renderDashboard(body, publicBaseUrl), {
			headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
		});
	} catch {
		return Response.json({ error: "dashboard_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
	}
}

async function operatorFeedback(request: Request, database: Pick<GameDatabase, "storeFeedback"> | undefined): Promise<Response> {
	if (!database) return new Response("dashboard_unavailable", { status: 503, headers: { "cache-control": "no-store" } });
	if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
	try {
		const contentType = request.headers.get("content-type") ?? "";
		const raw = contentType.includes("application/json") ? await request.json() as Record<string, unknown> : Object.fromEntries(await request.formData()) as Record<string, unknown>;
		const feedback: Record<string, unknown> = { text: raw.text };
		for (const key of ["gameId", "userId", "mode", "mapId", "topic"] as const) if (typeof raw[key] === "string" && raw[key].trim()) feedback[key] = raw[key];
		if (raw.rating !== undefined && raw.rating !== "") feedback.rating = typeof raw.rating === "number" ? raw.rating : Number(raw.rating);
		validateFeedbackSubmission(feedback);
		const stored = database.storeFeedback(feedback as FeedbackSubmission);
		if (request.headers.get("hx-request") === "true") return new Response(`<p class="text-sm text-emerald-700">Feedback saved.</p>`, { headers: { "cache-control": "no-store" } });
		return Response.json({ ok: true, id: stored.id }, { status: 201, headers: { "cache-control": "no-store" } });
	} catch {
		return new Response("Invalid feedback", { status: 400, headers: { "cache-control": "no-store" } });
	}
}

async function apiTokens(request: Request, database: Pick<GameDatabase, "createDashboardApiToken" | "listDashboardApiTokens" | "revokeDashboardApiToken"> | undefined, pathname: string): Promise<Response> {
	if (!database) return new Response("dashboard_unavailable", { status: 503 });
	const basePath = pathname === DASHBOARD_API_KEYS_PATH || pathname.startsWith(`${DASHBOARD_API_KEYS_PATH}/`) ? DASHBOARD_API_KEYS_PATH : DASHBOARD_API_TOKENS_PATH;
	if (pathname !== basePath) {
		if (request.method !== "DELETE") return new Response("Method not allowed", { status: 405 });
		const id = pathname.slice(`${basePath}/`.length);
		return database.revokeDashboardApiToken(id) ? Response.json({ ok: true }) : notFound();
	}
	if (request.method === "DELETE") {
		try {
			const contentType = request.headers.get("content-type") ?? "";
			const queryId = new URL(request.url).searchParams.get("id");
			const body = queryId ? {} : contentType.includes("application/json") ? await request.json() as { id?: unknown } : Object.fromEntries(await request.formData()) as { id?: unknown };
			const rawId = queryId ?? body.id;
			const id = typeof rawId === "string" ? rawId.trim() : "";
			return id && database.revokeDashboardApiToken(id) ? new Response("API key removed.", { headers: { "cache-control": "no-store" } }) : new Response("Token not found.", { status: 404, headers: { "cache-control": "no-store" } });
		} catch {
			return new Response("Invalid token request", { status: 400, headers: { "cache-control": "no-store" } });
		}
	}
	if (request.method === "GET") return Response.json({ tokens: database.listDashboardApiTokens() });
	if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, POST" } });
	try {
		const contentType = request.headers.get("content-type") ?? "";
		const body = contentType.includes("application/json") ? await request.json() as { label?: unknown } : Object.fromEntries(await request.formData()) as { label?: unknown };
		const created = database.createDashboardApiToken(typeof body.label === "string" ? body.label : "bot");
		if (request.headers.get("hx-request") === "true") return new Response(`<p class="text-sm text-emerald-700">API key created. Copy it now; it will not be shown again:</p><code class="mt-2 block break-all rounded bg-slate-100 p-3 text-xs">${escapeHtml(created.token)}</code><p class="mt-2 text-xs text-slate-500">Token ID: ${escapeHtml(created.record.id)}</p>`, { status: 201, headers: { "cache-control": "no-store" } });
		return Response.json(created, { status: 201, headers: { "cache-control": "no-store" } });
	} catch { return new Response("Invalid token request", { status: 400 }); }
}

async function debugAssetTokens(request: Request, database: Pick<GameDatabase, "createDebugAssetToken" | "listDebugAssetTokens" | "revokeDebugAssetToken"> | undefined): Promise<Response> {
	if (!database) return new Response("dashboard_unavailable", { status: 503 });
	if (request.method === "GET") return Response.json({ tokens: database.listDebugAssetTokens() }, { headers: { "cache-control": "no-store" } });
	if (request.method === "DELETE") {
		const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
		return id && database.revokeDebugAssetToken(id) ? Response.json({ ok: true }) : new Response("Token not found.", { status: 404 });
	}
	if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, POST, DELETE" } });
	try {
		const contentType = request.headers.get("content-type") ?? "";
		const body = contentType.includes("application/json") ? await request.json() as { label?: unknown } : Object.fromEntries(await request.formData()) as { label?: unknown };
		const created = database.createDebugAssetToken(typeof body.label === "string" ? body.label : "designer");
		if (request.headers.get("hx-request") === "true") return new Response(`<p class="text-sm text-emerald-700">Debug asset key created. Copy it now; it will not be shown again:</p><code class="mt-2 block break-all rounded bg-slate-100 p-3 text-xs">${escapeHtml(created.token)}</code><p class="mt-2 text-xs text-slate-500">Token ID: ${escapeHtml(created.record.id)}</p>`, { status: 201, headers: { "cache-control": "no-store" } });
		return Response.json(created, { status: 201, headers: { "cache-control": "no-store" } });
	} catch { return new Response("Invalid token request", { status: 400 }); }
}

function operatorReplays(request: Request, registry: Pick<GameRegistry, "killGame">, database: Pick<GameDatabase, "listOperatorReplays" | "getOperatorReplay" | "createOperatorReplayView"> | undefined, pathname: string, requestedGameId: string | null, publicBaseUrl?: string): Response {
	const suffix = pathname.slice(DASHBOARD_REPLAYS_PATH.length).replace(/^\//, "");
	const segments = suffix.split("/");
	if (segments.length === 2 && segments[1] === "kill" && segments[0]) {
		if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
		const gameId = decodeURIComponent(segments[0]);
		if (!registry.killGame(gameId)) return notFound();
		if (wantsJson(request)) return Response.json({ ok: true, gameId }, { headers: { "cache-control": "no-store" } });
		return new Response(null, { status: 303, headers: { location: dashboardUrl(publicBaseUrl, DASHBOARD_REPLAYS_PATH), "cache-control": "no-store" } });
	}
	if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { allow: "GET", "cache-control": "no-store" } });
	if (!database) return new Response("dashboard_unavailable", { status: 503, headers: { "cache-control": "no-store" } });
	try {
		if (segments.length === 2 && segments[1] === "view" && segments[0]) {
			const gameId = decodeURIComponent(segments[0]);
			const replay = database.getOperatorReplay(gameId);
			if (!replay) return notFound();
			const view = database.createOperatorReplayView(gameId, replay);
			return new Response(null, { status: 303, headers: { location: replayViewerUrl(view.token, publicBaseUrl), "cache-control": "no-store" } });
		}
		if (suffix && segments.length === 1) {
			const replay = database.getOperatorReplay(decodeURIComponent(suffix));
			if (!replay) return notFound();
			return Response.json(replay, { headers: { "content-disposition": `attachment; filename="kore-replay-${safeFilename(suffix)}.json"`, "cache-control": "no-store" } });
		}
		const gameId = requestedGameId?.trim() || undefined;
		const body: DashboardReplayIndexResponse = { schemaVersion: 1, replays: database.listOperatorReplays(gameId), filter: gameId ? { gameId } : {} };
		if (wantsJson(request)) return Response.json(body, { headers: { "cache-control": "no-store" } });
		if (request.headers.get("HX-Request") === "true") return new Response(renderReplayTable(body, publicBaseUrl), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
		return new Response(renderReplayDashboard(body, publicBaseUrl), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
	} catch {
		return Response.json({ error: "dashboard_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
	}
}

function databaseDownload(request: Request, database: Pick<GameDatabase, "exportSnapshot"> | undefined): Response {
	if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { allow: "GET", "cache-control": "no-store" } });
	if (!database) return new Response("dashboard_unavailable", { status: 503, headers: { "cache-control": "no-store" } });
	try {
		const snapshot = database.exportSnapshot();
		const body = new ArrayBuffer(snapshot.byteLength);
		new Uint8Array(body).set(snapshot);
		return new Response(body, { headers: { "content-type": "application/vnd.sqlite3", "content-disposition": "attachment; filename=\"kore-backup.sqlite3\"", "cache-control": "no-store" } });
	} catch {
		return new Response("dashboard_unavailable", { status: 503, headers: { "cache-control": "no-store" } });
	}
}

function wantsJson(request: Request): boolean {
	const url = new URL(request.url);
	return url.searchParams.get("format") === "json" || request.headers.get("accept")?.includes("application/json") === true;
}

export function metricsResponse(metrics: MatchMetrics, performance: DashboardPerformanceMetrics = emptyPerformanceMetrics(), feedback: StoredFeedback[] = []): DashboardMetricsResponse {
	const playtestFeedback = feedback.filter(entry => entry.playtest === true);
	const ratings = playtestFeedback.flatMap(entry => entry.rating === undefined ? [] : [entry.rating]);
	const topics = playtestFeedback.reduce<Record<string, number>>((counts, entry) => { const topic = entry.topic ?? "unclassified"; counts[topic] = (counts[topic] ?? 0) + 1; return counts; }, {});
	return {
		schemaVersion: 1,
		measuredAt: metrics.measuredAt,
		counts: {
			allTime: metrics.allTime,
			offlineMatches: metrics.offlineMatches,
			playtestMatches: metrics.playtestMatches,
			playersAllTime: metrics.playersAllTime,
			playersOnline: metrics.playersOnline,
			now: metrics.now,
			paused: metrics.paused,
			sleeping: metrics.sleeping,
		},
		offlineModes: metrics.offlineModes.map(metric => ({ ...metric })),
		performance,
		feedback: feedback.map(entry => structuredClone(entry)),
		playtest: { matches: metrics.playtestMatches, feedback: playtestFeedback.length, averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null, topics },
		mapUsage: metrics.mapUsage.map(metric => ({ ...metric })),
		mostPlayedMap: metrics.mostPlayedMap && { ...metrics.mostPlayedMap },
		freshness: FRESHNESS,
	};
}

function emptyPerformanceMetrics(): DashboardPerformanceMetrics {
	const empty = { samples: 0, average: null, median: null, p90: null, max: null, previousMedian: null, trend: Array.from({ length: 12 }, () => ({ samples: 0, value: null })) } as const;
	return { today: empty, yesterday: empty, week: empty };
}

function isAuthorized(request: Request, secret: string | undefined): boolean {
	const authorization = request.headers.get("authorization");
	if (!secret) return false;
	if (authorization?.startsWith("Bearer ") && equalSecret(authorization.slice("Bearer ".length), secret)) return true;
	return isSessionToken(readCookie(request.headers.get("cookie"), DASHBOARD_COOKIE), secret);
}

function isBearerApiToken(request: Request, database: Pick<GameDatabase, "isDashboardApiTokenValid">): boolean {
	const authorization = request.headers.get("authorization");
	return authorization?.startsWith("Bearer ") === true && database.isDashboardApiTokenValid(authorization.slice("Bearer ".length));
}

async function login(request: Request, secret: string | undefined, publicBaseUrl?: string): Promise<Response> {
	if (!secret) return notFound();
	if (request.method === "GET") return new Response(renderLogin(publicBaseUrl), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
	if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, POST", "cache-control": "no-store" } });
	try {
		const password = await loginPassword(request);
		if (!password || !equalSecret(password, secret)) return notFound();
		const headers = { "set-cookie": sessionCookie(secret, publicBaseUrl), "cache-control": "no-store" };
		if (request.headers.get("accept")?.includes("text/html")) return new Response(null, { status: 303, headers: { ...headers, location: dashboardUrl(publicBaseUrl, DASHBOARD_PATH) } });
		return Response.json({ ok: true }, { headers });
	} catch { return notFound(); }
}

async function loginPassword(request: Request): Promise<string | undefined> {
	if (request.headers.get("content-type")?.includes("application/json")) {
		const body = await request.json() as { password?: unknown };
		return typeof body.password === "string" ? body.password : undefined;
	}
	const form = await request.formData();
	const password = form.get("password");
	return typeof password === "string" ? password : undefined;
}

function logout(request: Request, secret: string | undefined, publicBaseUrl?: string): Response {
	if (!secret || !isAuthorized(request, secret)) return notFound();
	if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
	return Response.json({ ok: true }, { headers: { "set-cookie": `${DASHBOARD_COOKIE}=; Path=${operatorCookiePath(publicBaseUrl)}; HttpOnly; Secure; SameSite=Strict; Max-Age=0`, "cache-control": "no-store" } });
}

function sessionToken(secret: string): string {
	const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
	const payload = `kore-operator-dashboard-session-v1.${expiresAt}`;
	return `${expiresAt}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

function sessionCookie(secret: string, publicBaseUrl?: string): string {
	return `${DASHBOARD_COOKIE}=${sessionToken(secret)}; Path=${operatorCookiePath(publicBaseUrl)}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

function isSessionToken(token: string, secret: string): boolean {
	const [expiresAt, signature, ...extra] = token.split(".");
	if (extra.length || !expiresAt || !signature || !/^\d+$/.test(expiresAt) || Number(expiresAt) < Math.floor(Date.now() / 1000)) return false;
	const expected = createHmac("sha256", secret).update(`kore-operator-dashboard-session-v1.${expiresAt}`).digest("base64url");
	return equalSecret(signature, expected);
}

function readCookie(header: string | null, name: string): string {
	if (!header) return "";
	return header.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

function equalSecret(supplied: string, expected: string): boolean {
	const suppliedBytes = Buffer.from(supplied);
	const expectedBytes = Buffer.from(expected);
	return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

function notFound(): Response {
	return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
}

function renderDashboard(metrics: DashboardMetricsResponse, publicBaseUrl?: string): string {
	const mostPlayed = metrics.mostPlayedMap ? escapeHtml(`${metrics.mostPlayedMap.mapId} (${metrics.mostPlayedMap.games} games, ${metrics.mostPlayedMap.percentage}%)`) : "No matches yet";
	const rows = metrics.mapUsage.map(metric => `<tr class="border-t border-slate-100"><td class="px-4 py-3 font-medium text-slate-700">${escapeHtml(metric.mapId)}</td><td class="px-4 py-3 text-right text-slate-500">${metric.games}</td><td class="px-4 py-3 text-right font-semibold text-slate-700">${metric.percentage}%</td></tr>`).join("") || "<tr><td class=\"px-4 py-6 text-center text-slate-400\" colspan=\"3\">No matches yet</td></tr>";
	const latencyPeriods = JSON.stringify(metrics.performance);
	const currentLatency = metrics.performance.today;
	const displayMs = (value: number | null): string => value === null ? "No data" : `${Number(value.toFixed(2))}ms`;
	const replayUrl = dashboardUrl(publicBaseUrl, DASHBOARD_REPLAYS_PATH);
	const databaseUrl = dashboardUrl(publicBaseUrl, DASHBOARD_DATABASE_PATH);
	const offlineModeLabels: Record<string, string> = { hotseat: "Hotseat", "human-vs-ai": "Human vs AI", "ai-battle": "AI vs AI" };
	const offlineModeRows = metrics.offlineModes.map(mode => `<div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><span class="text-sm text-slate-600">${offlineModeLabels[mode.mode] ?? escapeHtml(mode.mode)}</span><strong class="text-sm">${mode.games}</strong></div>`).join("") || `<p class="text-sm text-slate-400">No offline reports yet.</p>`;
	const feedbackRows = metrics.feedback.map(entry => `<article class="rounded-xl border border-slate-200 bg-slate-50 p-4"><div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div class="flex flex-wrap items-center gap-2"><span class="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-700">${escapeHtml(entry.mode ?? "unknown")}</span>${entry.mapId ? `<span class="text-xs font-medium text-slate-500">${escapeHtml(entry.mapId)}</span>` : ""}${entry.topic ? `<span class="text-xs font-semibold text-violet-600">${escapeHtml(entry.topic)}</span>` : ""}${entry.rating !== undefined ? `<span class="text-xs font-semibold text-amber-600">Rating: ${entry.rating}/5</span>` : ""}${entry.gameId ? `<span class="font-mono text-xs text-slate-400">${escapeHtml(entry.gameId)}</span>` : ""}</div><time class="text-xs text-slate-400" datetime="${new Date(entry.createdAt).toISOString()}">${escapeHtml(new Date(entry.createdAt).toLocaleString("en-US"))}</time></div><p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">${escapeHtml(entry.text)}</p>${entry.userId ? `<p class="mt-2 text-xs text-slate-400">Player: ${escapeHtml(entry.userId)}</p>` : ""}</article>`).join("") || `<p class="text-sm text-slate-400">No feedback yet.</p>`;
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>KORE operator dashboard</title>
 <script src="https://cdn.tailwindcss.com"></script><script src="https://unpkg.com/htmx.org@2.0.4"></script><style>@keyframes kore-latency-rise{from{transform:scaleY(0)}to{transform:scaleY(1)}}[data-latency-bar]{transform-origin:bottom;transform:scaleY(0);animation:kore-latency-rise .55s cubic-bezier(.22,1,.36,1) forwards}</style><script>tailwind.config={theme:{extend:{fontFamily:{sans:['Inter','ui-sans-serif','system-ui']}}}}</script></head>
<body class="min-h-screen bg-slate-950 font-sans text-slate-900"><div class="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,.16),_transparent_34rem)]">
<header class="border-b border-white/10 bg-slate-950/80 text-white backdrop-blur"><div class="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8"><div><p class="text-xs font-bold uppercase tracking-[.28em] text-cyan-300">KORE / OPERATIONS</p><h1 class="mt-1 text-2xl font-semibold tracking-tight">Game state overview</h1></div><nav class="flex items-center gap-2"><a class="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white" href="${replayUrl}">Replay archive</a><a class="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300" href="${databaseUrl}">Download backup</a></nav></div></header>
<main class="mx-auto max-w-7xl space-y-6 px-5 py-8 lg:px-8">
<section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p class="text-sm font-medium text-cyan-400">Live control room</p><h2 class="mt-1 text-3xl font-bold tracking-tight text-white">How the game is doing</h2><p class="mt-2 max-w-2xl text-sm text-slate-400">A high-level view of participation, match lifecycle, map adoption and operator performance.</p></div><div class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300"><span class="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400"></span>Measured ${new Date(metrics.measuredAt).toLocaleString("en-US")}</div></section>
 <div id="dashboard-live" class="space-y-6" data-latency="${escapeHtml(latencyPeriods)}" hx-get="${dashboardUrl(publicBaseUrl, DASHBOARD_PATH)}?fragment=stats" hx-trigger="every 60s" hx-select="#dashboard-live" hx-swap="outerHTML">
 <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
${dashboardCard("All-time matches", metrics.counts.allTime, "data-metric=\"allTime\"", "Every durable match", "cyan")}
${dashboardCard("Players online", metrics.counts.playersOnline, "data-metric=\"playersOnline\"", "Across non-sleeping games", "emerald")}
${dashboardCard("Matches now", metrics.counts.now, "data-metric=\"now\"", "Resident in this process", "violet")}
${dashboardCard("All-time players", metrics.counts.playersAllTime, "data-metric=\"playersAllTime\"", "Distinct player identities", "amber")}
${dashboardCard("Offline / KI matches", metrics.counts.offlineMatches, "data-metric=\"offlineMatches\"", "Reported from production clients", "rose")}${dashboardCard("Human playtests", metrics.counts.playtestMatches ?? 0, "data-metric=\"playtestMatches\"", "Matches started from the Human Playtest flow", "violet")}
</section>
<section class="grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/10"><div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p class="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Response time</p><h3 class="mt-2 text-xl font-bold text-slate-900">Latency comparison</h3><p class="mt-1 text-sm text-slate-500">Computed from persisted online reports and offline performance logs.</p></div><div id="latency-tabs" class="flex rounded-lg bg-slate-100 p-1"><button data-period="today" class="rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm">Today</button><button data-period="yesterday" class="rounded-md px-3 py-2 text-xs font-semibold text-slate-500">Yesterday</button><button data-period="week" class="rounded-md px-3 py-2 text-xs font-semibold text-slate-500">Last 7 days</button></div></div>
<div class="mt-7 grid gap-4 sm:grid-cols-3"><div class="rounded-xl bg-slate-950 p-4 text-white"><p class="text-xs text-slate-400">Median</p><p id="latency-median" class="mt-2 text-3xl font-bold">${displayMs(currentLatency.median)}</p><p id="latency-delta" class="mt-2 text-xs font-medium text-slate-400">${currentLatency.previousMedian === null || currentLatency.median === null ? "No comparison data" : "Compared with yesterday"}</p></div><div class="rounded-xl border border-slate-200 p-4"><p class="text-xs text-slate-500">p90</p><p id="latency-p90" class="mt-2 text-3xl font-bold text-slate-900">${displayMs(currentLatency.p90)}</p><p class="mt-2 text-xs text-slate-500">90% of samples are below this</p></div><div class="rounded-xl border border-slate-200 p-4"><p class="text-xs text-slate-500">Average</p><p id="latency-average" class="mt-2 text-3xl font-bold text-slate-900">${displayMs(currentLatency.average)}</p><p class="mt-2 text-xs text-slate-500">Across the selected period</p></div></div>
 <div class="mt-6 flex h-40 items-end gap-2" aria-label="Latency trend">${latencyBars(currentLatency.trend)}</div><div class="mt-2 flex justify-between text-[10px] font-medium uppercase tracking-wider text-slate-400"><span data-latency-label>00:00</span><span data-latency-label>06:00</span><span data-latency-label>12:00</span><span data-latency-label>Now</span></div></div>
<div class="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-white shadow-xl shadow-slate-950/20"><p class="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Match lifecycle</p><h3 class="mt-2 text-xl font-bold">Current state</h3><div class="mt-6 space-y-5">${statusBar("Resident", metrics.counts.now, metrics.counts.allTime, "bg-cyan-400", "Matches currently loaded")}${statusBar("Paused matches", metrics.counts.paused, metrics.counts.allTime, "bg-amber-400", "Waiting for players")}${statusBar("Sleeping matches", metrics.counts.sleeping, metrics.counts.allTime, "bg-slate-500", "Restored on reconnect")}</div><div class="mt-7 border-t border-white/10 pt-5"><p class="text-xs text-slate-500">Most played map</p><p class="mt-1 font-semibold text-cyan-300" data-metric="mostPlayedMap">${mostPlayed}</p></div></div></section>
<section class="grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/10"><div class="flex items-center justify-between"><div><p class="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Content mix</p><h3 class="mt-2 text-xl font-bold">Map usage</h3></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">${metrics.counts.allTime} total</span></div><div class="mt-5 overflow-hidden rounded-xl border border-slate-100"><table class="w-full text-left text-sm"><caption class="sr-only">Map usage by game count and percentage</caption><thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-400"><tr><th class="px-4 py-3">Map</th><th class="px-4 py-3 text-right">Games</th><th class="px-4 py-3 text-right">Share</th></tr></thead><tbody data-metric="mapUsage">${rows}</tbody></table></div></div><div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/10"><p class="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Operator signals</p><h3 class="mt-2 text-xl font-bold">Useful at a glance</h3><div class="mt-5 space-y-3"><div class="flex items-center justify-between rounded-xl bg-slate-50 p-4"><span class="text-sm text-slate-500">Distinct players</span><strong>${metrics.counts.playersAllTime}</strong></div><div class="flex items-center justify-between rounded-xl bg-slate-50 p-4"><span class="text-sm text-slate-500">Live player coverage</span><strong>${metrics.counts.allTime ? Math.round((metrics.counts.playersOnline / Math.max(metrics.counts.playersAllTime, 1)) * 100) : 0}%</strong></div><div class="flex items-center justify-between rounded-xl bg-slate-50 p-4"><span class="text-sm text-slate-500">Top map share</span><strong>${metrics.mostPlayedMap?.percentage ?? 0}%</strong></div></div><div class="mt-5 border-t border-slate-100 pt-4"><p class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Offline / KI breakdown</p><div class="space-y-2" data-metric="offlineModes">${offlineModeRows}</div></div><a class="mt-5 block text-sm font-semibold text-cyan-600 hover:text-cyan-700" href="${replayUrl}">Inspect replay activity <span aria-hidden="true">-&gt;</span></a></div></section>
  </div>
 <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/10"><div class="flex items-center justify-between"><div><p class="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Player voice</p><h3 class="mt-2 text-xl font-bold text-slate-900">Recent feedback</h3><p class="mt-1 text-sm text-slate-500">Newest submissions appear first.</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500" data-feedback-count>${metrics.feedback.length} submission${metrics.feedback.length === 1 ? "" : "s"}</span></div><div class="mt-5 space-y-3" data-feedback="list">${feedbackRows}</div></section>
 <section class="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-xl shadow-slate-950/10"><p class="text-xs font-bold uppercase tracking-[.18em] text-amber-700">Operator entry</p><h3 class="mt-2 text-xl font-bold text-slate-900">Add missed feedback</h3><p class="mt-1 text-sm text-slate-600">Use this when a game broke before the player could submit feedback.</p><form class="mt-5 grid gap-3 sm:grid-cols-2" method="post" action="${dashboardUrl(publicBaseUrl, DASHBOARD_FEEDBACK_PATH)}" hx-post="${dashboardUrl(publicBaseUrl, DASHBOARD_FEEDBACK_PATH)}" hx-target="#manual-feedback-status" hx-swap="innerHTML"><input name="gameId" class="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm" placeholder="Game ID (optional)"><input name="userId" class="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm" placeholder="Player ID (optional)"><input name="mode" class="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm" placeholder="Mode, e.g. online"><input name="mapId" class="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm" placeholder="Map ID (optional)"><select name="topic" class="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"><option value="">Topic (optional)</option><option value="bug">Bug</option><option value="balance">Balance</option><option value="controls">Controls</option><option value="other">Other</option></select><input name="rating" type="number" min="1" max="5" class="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm" placeholder="Rating 1-5 (optional)"><textarea name="text" required maxlength="2000" class="sm:col-span-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm" rows="4" placeholder="What did the player report?"></textarea><div class="sm:col-span-2 flex items-center gap-3"><button type="submit" class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">Save feedback</button><span id="manual-feedback-status" class="text-sm text-slate-600"></span></div></form></section>
 <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/10"><div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p class="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Bot access</p><h3 class="mt-2 text-xl font-bold text-slate-900">Metrics API tokens</h3><p class="mt-1 text-sm text-slate-500">Create a token once, then revoke it at any time.</p></div><div class="flex flex-wrap gap-2"><input name="label" form="add-api-token" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" value="metrics-bot" aria-label="API key label"><form id="add-api-token" hx-post="${dashboardUrl(publicBaseUrl, DASHBOARD_API_KEYS_PATH)}" hx-target="#api-token-status" hx-swap="innerHTML"><button type="submit" class="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-white">Add API key</button></form><input name="id" form="remove-api-token" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Token ID" aria-label="Token ID"><form id="remove-api-token" hx-delete="${dashboardUrl(publicBaseUrl, DASHBOARD_API_KEYS_PATH)}" hx-target="#api-token-status" hx-swap="innerHTML"><button type="submit" class="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white">Remove API key</button></form></div></div><p id="api-token-status" class="mt-4 whitespace-pre-wrap break-all text-sm text-slate-600"></p></section>
  <section class="rounded-2xl border border-violet-200 bg-violet-50 p-6 shadow-xl shadow-slate-950/10"><p class="text-xs font-bold uppercase tracking-[.18em] text-violet-700">Designer access</p><h3 class="mt-2 text-xl font-bold text-slate-900">Debug asset keys</h3><p class="mt-1 text-sm text-slate-600">These keys can only upload debug asset overrides. They cannot read metrics, backups, or production files.</p><div class="mt-5 flex flex-wrap gap-2"><input name="label" form="add-debug-asset-key" class="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm" value="designer" aria-label="Debug asset key label"><form id="add-debug-asset-key" hx-post="${dashboardUrl(publicBaseUrl, DASHBOARD_DEBUG_ASSET_KEYS_PATH)}" hx-target="#debug-asset-key-status" hx-swap="innerHTML"><button type="submit" class="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white">Create debug asset key</button></form></div><p id="debug-asset-key-status" class="mt-4 whitespace-pre-wrap break-all text-sm text-slate-600"></p></section>
  <footer class="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-xs leading-5 text-slate-400"><p data-freshness="metrics">${escapeHtml(metrics.freshness)}</p></footer></main></div>
<script>(function(){function ms(value){ return value===null?'No data':Number(value.toFixed(2))+'ms'}function selectPeriod(key){const root=document.querySelector('#dashboard-live');if(!root)return;const latency=JSON.parse(root.dataset.latency||'{}');const value=latency[key];if(!value)return;const median=root.querySelector('#latency-median');const p90=root.querySelector('#latency-p90');const average=root.querySelector('#latency-average');const delta=root.querySelector('#latency-delta');if(median)median.textContent=ms(value.median);if(p90)p90.textContent=ms(value.p90);if(average)average.textContent=ms(value.average);if(delta){if(value.median===null||value.previousMedian===null){delta.textContent='No comparison data';delta.className='mt-2 text-xs font-medium text-slate-400'}else{const difference=Math.round(((value.median-value.previousMedian)/value.previousMedian)*100);delta.textContent=difference<=0?Math.abs(difference)+'% faster than comparison period':difference+'% slower than comparison period';delta.className='mt-2 text-xs font-medium '+(difference<=0?'text-emerald-300':'text-rose-300')}}const labels=key==='week'?['6d ago','4d ago','2d ago','Now']:key==='yesterday'?['00:00','06:00','12:00','18:00']:['00:00','06:00','12:00','Now'];root.querySelectorAll('[data-latency-label]').forEach((label,index)=>{label.textContent=labels[index]||''});const points=value.trend||[];const max=Math.max(...points.map(point=>point.value??0),1);root.querySelectorAll('[data-latency-bar]').forEach((bar,index)=>{const point=points[index];const height=point?.value===null||point===undefined?8:Math.max(8,Math.round((point.value/max)*160));bar.style.height=height+'px';bar.title=point?.value===null||point===undefined?'No samples':ms(point.value)});root.querySelectorAll('[data-period]').forEach(tab=>{const active=tab.dataset.period===key;tab.className='rounded-md px-3 py-2 text-xs font-semibold '+(active?'bg-white text-slate-900 shadow-sm':'text-slate-500')})}document.addEventListener('click',event=>{const target=event.target;if(target instanceof Element){const tab=target.closest('[data-period]');if(tab)selectPeriod(tab.getAttribute('data-period')||'today')}});selectPeriod('today')})();</script></body></html>`;
}

function dashboardCard(label: string, value: number, attribute: string, detail: string, color: string): string {
	const accent = { cyan: "bg-cyan-400", emerald: "bg-emerald-400", violet: "bg-violet-400", amber: "bg-amber-400", rose: "bg-rose-400" }[color] ?? "bg-cyan-400";
	return `<div class="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5 text-white shadow-xl shadow-slate-950/20"><span class="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full ${accent} opacity-20 blur-2xl"></span><div class="relative"><div class="flex items-center justify-between"><p class="text-sm text-slate-400">${label}</p><span class="h-2 w-2 rounded-full ${accent}"></span></div><p class="mt-4 text-4xl font-bold tracking-tight" ${attribute}>${value}</p><p class="mt-2 text-xs text-slate-500">${detail}</p></div></div>`;
}

function latencyBars(trend: DashboardPerformanceTrendPoint[]): string {
	const max = Math.max(...trend.map(point => point.value ?? 0), 1);
	const colors = ["bg-cyan-100", "bg-cyan-200", "bg-cyan-300", "bg-cyan-400", "bg-cyan-500", "bg-cyan-600", "bg-cyan-700", "bg-cyan-800", "bg-cyan-700", "bg-cyan-600", "bg-cyan-500", "bg-cyan-400"];
	return trend.map((point, index) => {
		const height = point.value === null ? 8 : Math.max(8, Math.round((point.value / max) * 160));
		const title = point.value === null ? "No samples" : `${Number(point.value.toFixed(2))}ms median`;
		return `<div data-latency-bar class="${colors[index] ?? "bg-cyan-500"} flex-1 rounded-t" style="height:${height}px;animation-delay:${index * 70}ms" title="${title}"></div>`;
	}).join("");
}

function statusBar(label: string, value: number, total: number, color: string, detail: string): string {
	const percentage = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
	return `<div><div class="flex items-center justify-between text-sm"><span class="font-medium">${label}</span><span class="text-slate-400">${value} <span class="text-xs">(${percentage}%)</span></span></div><div class="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div class="h-full rounded-full ${color}" style="width:${percentage}%"></div></div><p class="mt-1 text-xs text-slate-500">${detail}</p></div>`;
}

function renderReplayDashboard(response: DashboardReplayIndexResponse, publicBaseUrl?: string): string {
	const filter = response.filter.gameId ?? "";
	const dashboardLink = dashboardUrl(publicBaseUrl, DASHBOARD_PATH);
	const backupLink = dashboardUrl(publicBaseUrl, DASHBOARD_DATABASE_PATH);
	const archiveLink = dashboardUrl(publicBaseUrl, DASHBOARD_REPLAYS_PATH);
	const completed = response.replays.filter(replay => replay.status === "completed").length;
	const active = response.replays.length - completed;
	const rows = response.replays.map(replay => {
		const encodedId = encodeURIComponent(replay.gameId);
		const downloadUrl = dashboardUrl(publicBaseUrl, `${DASHBOARD_REPLAYS_PATH}/${encodedId}`);
		const viewUrl = dashboardUrl(publicBaseUrl, `${DASHBOARD_REPLAYS_PATH}/${encodedId}/view`);
		const killUrl = dashboardUrl(publicBaseUrl, `${DASHBOARD_REPLAYS_PATH}/${encodedId}/kill`);
		const statusClass = replay.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
		const gameTypeClass = replay.gameType === "ai" ? "bg-violet-100 text-violet-700" : "bg-cyan-100 text-cyan-700";
		const kill = replay.status === "completed" ? "" : `<form method="post" action="${escapeHtml(killUrl)}" onsubmit="return confirm('Mark this stuck game as completed with a draw?');"><button class="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50" type="submit">Kill game</button></form>`;
		return `<tr class="border-t border-slate-100 transition hover:bg-slate-50"><td class="px-5 py-4"><div class="font-mono text-xs font-semibold text-slate-700">${escapeHtml(replay.gameId)}</div><div class="mt-1 text-xs text-slate-400">Match identifier</div></td><td class="px-5 py-4"><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${gameTypeClass}">${escapeHtml(replay.gameType)}</span></td><td class="px-5 py-4"><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}">${escapeHtml(replay.status)}</span></td><td class="px-5 py-4 text-sm text-slate-500">${escapeHtml(new Date(replay.updatedAt).toLocaleString("en-US"))}</td><td class="px-5 py-4 text-right text-sm font-semibold text-slate-700">${replay.actionCount}</td><td class="px-5 py-4"><div class="flex flex-wrap gap-2"><a class="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300" href="${escapeHtml(viewUrl)}" target="_blank" rel="noopener noreferrer">View replay</a><a class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-cyan-300 hover:text-slate-900" href="${escapeHtml(downloadUrl)}">Download</a>${kill}</div></td></tr>`;
	}).join("") || "<tr><td class=\"px-5 py-12 text-center text-sm text-slate-400\" colspan=\"6\">No persisted replay matches this filter.</td></tr>";
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>KORE replay archive</title>
<script src="https://cdn.tailwindcss.com"></script><script src="https://unpkg.com/htmx.org@2.0.4"></script><script>tailwind.config={theme:{extend:{fontFamily:{sans:['Inter','ui-sans-serif','system-ui'],mono:['ui-monospace','SFMono-Regular','monospace']}}}}</script></head>
<body class="min-h-screen bg-slate-950 font-sans text-slate-900"><div class="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,.16),_transparent_34rem)]">
<header class="border-b border-white/10 bg-slate-950/80 text-white backdrop-blur"><div class="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8"><div><p class="text-xs font-bold uppercase tracking-[.28em] text-cyan-300">KORE / OPERATIONS</p><h1 class="mt-1 text-2xl font-semibold tracking-tight">Replay archive</h1></div><nav class="flex items-center gap-2"><a class="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white" href="${dashboardLink}">Dashboard</a><a class="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300" href="${backupLink}">Download backup</a></nav></div></header>
<main class="mx-auto max-w-7xl space-y-6 px-5 py-8 lg:px-8">
<section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p class="text-sm font-medium text-cyan-400">Persisted match history</p><h2 class="mt-1 text-3xl font-bold tracking-tight text-white">Review every recorded game</h2><p class="mt-2 max-w-2xl text-sm text-slate-400">Open a read-only playback, download its deterministic replay document, or narrow the archive by match ID.</p></div><a class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white" href="${archiveLink}">Refresh archive</a></section>
<section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">${replayCard("Archived replays", response.replays.length, "Every persisted match", "cyan")}${replayCard("Completed", completed, "Finished match records", "emerald")}${replayCard("In progress", active, "Restorable match records", "amber")}${replayCard("Recorded actions", response.replays.reduce((total, replay) => total + replay.actionCount, 0), "Across the current result set", "violet")}</section>
 <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/10"><div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p class="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Archive search</p><h3 class="mt-2 text-xl font-bold text-slate-900">Find a match</h3><p class="mt-1 text-sm text-slate-500">Search by the exact persisted match ID.</p></div><form class="flex w-full gap-2 sm:w-auto" method="get" action="${archiveLink}" hx-get="${archiveLink}" hx-target="#replay-table" hx-swap="outerHTML" hx-push-url="true"><label class="sr-only" for="replay-match-id">Match ID</label><input id="replay-match-id" class="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 sm:w-80" name="id" value="${escapeHtml(filter)}" autocomplete="off" placeholder="Match ID" hx-get="${archiveLink}" hx-trigger="input changed delay:500ms" hx-target="#replay-table" hx-swap="outerHTML" hx-push-url="true"><button class="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800" type="submit">Filter</button>${filter ? `<a class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300" href="${archiveLink}">Clear</a>` : ""}</form></div></section>
 <section id="replay-table" class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-950/10"><div class="flex flex-col justify-between gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center"><div><p class="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Replay records</p><h3 class="mt-2 text-xl font-bold text-slate-900">${filter ? "Filtered matches" : "All persisted matches"}</h3></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">${response.replays.length} result${response.replays.length === 1 ? "" : "s"}</span></div><div class="overflow-x-auto"><table class="w-full min-w-[820px] text-left"><caption class="sr-only">Persisted match replays</caption><thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-400"><tr><th class="px-5 py-3">Match ID</th><th class="px-5 py-3">Type</th><th class="px-5 py-3">Status</th><th class="px-5 py-3">Updated</th><th class="px-5 py-3 text-right">Actions</th><th class="px-5 py-3">Replay</th></tr></thead><tbody data-replays="index">${rows}</tbody></table></div></section>
<footer class="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-xs leading-5 text-slate-400">Replay documents are immutable records. View playback is read-only and downloads retain the canonical replay JSON.</footer></main></div></body></html>`;
}

function replayCard(label: string, value: number, detail: string, color: string): string {
	const accent = { cyan: "bg-cyan-400", emerald: "bg-emerald-400", amber: "bg-amber-400", violet: "bg-violet-400" }[color] ?? "bg-cyan-400";
	return `<div class="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5 text-white shadow-xl shadow-slate-950/20"><span class="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full ${accent} opacity-20 blur-2xl"></span><div class="relative"><div class="flex items-center justify-between"><p class="text-sm text-slate-400">${label}</p><span class="h-2 w-2 rounded-full ${accent}"></span></div><p class="mt-4 text-4xl font-bold tracking-tight">${value}</p><p class="mt-2 text-xs text-slate-500">${detail}</p></div></div>`;
}

function renderReplayTable(response: DashboardReplayIndexResponse, publicBaseUrl?: string): string {
	const rows = response.replays.map(replay => {
		const encodedId = encodeURIComponent(replay.gameId);
		const downloadUrl = dashboardUrl(publicBaseUrl, `${DASHBOARD_REPLAYS_PATH}/${encodedId}`);
		const viewUrl = dashboardUrl(publicBaseUrl, `${DASHBOARD_REPLAYS_PATH}/${encodedId}/view`);
		const statusClass = replay.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
		const gameTypeClass = replay.gameType === "ai" ? "bg-violet-100 text-violet-700" : "bg-cyan-100 text-cyan-700";
		return `<tr class="border-t border-slate-100 transition hover:bg-slate-50"><td class="px-5 py-4"><div class="font-mono text-xs font-semibold text-slate-700">${escapeHtml(replay.gameId)}</div><div class="mt-1 text-xs text-slate-400">Match identifier</div></td><td class="px-5 py-4"><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${gameTypeClass}">${escapeHtml(replay.gameType)}</span></td><td class="px-5 py-4"><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}">${escapeHtml(replay.status)}</span></td><td class="px-5 py-4 text-sm text-slate-500">${escapeHtml(new Date(replay.updatedAt).toLocaleString("en-US"))}</td><td class="px-5 py-4 text-right text-sm font-semibold text-slate-700">${replay.actionCount}</td><td class="px-5 py-4"><div class="flex flex-wrap gap-2"><a class="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300" href="${escapeHtml(viewUrl)}" target="_blank" rel="noopener noreferrer">View replay</a><a class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-cyan-300 hover:text-slate-900" href="${escapeHtml(downloadUrl)}">Download</a></div></td></tr>`;
	}).join("") || "<tr><td colspan=\"6\">No replay found</td></tr>";
	return `<section id="replay-table" class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-950/10"><div class="flex flex-col justify-between gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center"><div><p class="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Replay records</p><h3 class="mt-2 text-xl font-bold text-slate-900">${response.filter.gameId ? "Filtered matches" : "All persisted matches"}</h3></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">${response.replays.length} result${response.replays.length === 1 ? "" : "s"}</span></div><div class="overflow-x-auto"><table class="w-full min-w-[820px] text-left"><caption class="sr-only">Persisted match replays</caption><thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-400"><tr><th class="px-5 py-3">Match ID</th><th class="px-5 py-3">Type</th><th class="px-5 py-3">Status</th><th class="px-5 py-3">Updated</th><th class="px-5 py-3 text-right">Actions</th><th class="px-5 py-3">Replay</th></tr></thead><tbody data-replays="index">${rows}</tbody></table></div></section>`;
}

function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function safeFilename(value: string): string { return value.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "replay"; }
function replayViewerUrl(token: string, publicBaseUrl?: string): string {
	const url = publicBaseUrl ? new URL(publicBaseUrl) : new URL("https://operator.invalid/");
	url.search = ""; url.hash = ""; url.searchParams.set("replay", token);
	return publicBaseUrl ? url.toString() : `${url.pathname}${url.search}`;
}

export function dashboardUrl(publicBaseUrl: string | undefined, path: string): string {
	if (!publicBaseUrl) return path;
	const base = new URL(publicBaseUrl);
	base.search = "";
	base.hash = "";
	if (!base.pathname.endsWith("/")) base.pathname += "/";
	return new URL(path.replace(/^\//, ""), base).toString();
}

function operatorCookiePath(publicBaseUrl?: string): string {
	if (!publicBaseUrl) return "/operator";
	const base = new URL(publicBaseUrl);
	if (!base.pathname.endsWith("/")) base.pathname += "/";
	return new URL("operator", base).pathname;
}

function renderLogin(publicBaseUrl?: string): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>KORE operator login</title></head><body><main><h1>KORE operator login</h1><form method="post" action="${dashboardUrl(publicBaseUrl, DASHBOARD_LOGIN_PATH)}"><label>Password <input type="password" name="password" autocomplete="current-password" required></label><button type="submit">Sign in</button></form></main></body></html>`;
}
