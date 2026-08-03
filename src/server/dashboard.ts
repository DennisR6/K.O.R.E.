import { createHmac, timingSafeEqual } from "node:crypto";
import type { GameDatabase } from "./db.js";
import type { GameRegistry } from "./gameRegistry.js";
import type { MatchMetrics } from "./types.js";

export const DASHBOARD_METRICS_PATH = "/operator/dashboard/metrics";
export const DASHBOARD_PATH = "/operator/dashboard";
export const DASHBOARD_LOGIN_PATH = "/operator/login";
export const DASHBOARD_LOGOUT_PATH = "/operator/logout";
export const DASHBOARD_DATABASE_PATH = "/operator/db";
const DASHBOARD_COOKIE = "kore_operator_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const FRESHNESS = "allTime, paused, and sleeping are durable SQLite lifecycle aggregates; now is scoped to this server process's resident registry cache.";

export type DashboardConfig = { operatorSecret: string | undefined };

export type DashboardMetricsResponse = {
	schemaVersion: 1;
	measuredAt: number;
	counts: Pick<MatchMetrics, "allTime" | "now" | "paused" | "sleeping">;
	freshness: typeof FRESHNESS;
};

/** Reads a deployment-only secret; unset or weak values deliberately disable routes. */
export function readDashboardConfig(env: Record<string, string | undefined> = process.env): DashboardConfig {
	const secret = env.KORE_DASHBOARD_OPERATOR_SECRET;
	return { operatorSecret: typeof secret === "string" && Buffer.byteLength(secret) >= 32 ? secret : undefined };
}

export function isDashboardPath(pathname: string): boolean {
	return pathname === DASHBOARD_PATH || pathname === DASHBOARD_METRICS_PATH || pathname === DASHBOARD_LOGIN_PATH || pathname === DASHBOARD_LOGOUT_PATH || pathname === DASHBOARD_DATABASE_PATH;
}

/**
 * Handles the two exact operator routes. `/operator/dashboard?format=json`
 * serves the complete dashboard payload as JSON while retaining the same
 * authentication and no-store policy as the HTML representation. Undefined means the caller should
 * continue normal routing; disabled or unauthorized dashboard paths are an
 * indistinguishable not-found response to avoid endpoint discovery.
 */
export async function serveDashboard(request: Request, registry: Pick<GameRegistry, "getMetrics">, config: DashboardConfig, database?: Pick<GameDatabase, "exportSnapshot">, publicBaseUrl?: string): Promise<Response | undefined> {
	const pathname = new URL(request.url).pathname;
	if (!isDashboardPath(pathname)) return undefined;
	if (pathname === DASHBOARD_LOGIN_PATH) return login(request, config.operatorSecret, publicBaseUrl);
	if (pathname === DASHBOARD_LOGOUT_PATH) return logout(request, config.operatorSecret);
	if (!isAuthorized(request, config.operatorSecret)) return notFound();
	if (pathname === DASHBOARD_DATABASE_PATH) return databaseDownload(request, database);
	if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { allow: "GET", "cache-control": "no-store" } });
	try {
		const metrics = registry.getMetrics();
		const body = metricsResponse(metrics);
		if (pathname === DASHBOARD_METRICS_PATH || wantsJson(request)) {
			return Response.json(body, { headers: { "cache-control": "no-store" } });
		}
		return new Response(renderDashboard(body), {
			headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
		});
	} catch {
		return Response.json({ error: "dashboard_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
	}
}

function databaseDownload(request: Request, database: Pick<GameDatabase, "exportSnapshot"> | undefined): Response {
	if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { allow: "GET", "cache-control": "no-store" } });
	if (!database) return new Response("dashboard_unavailable", { status: 503, headers: { "cache-control": "no-store" } });
	try {
		return new Response(database.exportSnapshot().buffer as ArrayBuffer, { headers: { "content-type": "application/vnd.sqlite3", "content-disposition": "attachment; filename=\"kore-backup.sqlite3\"", "cache-control": "no-store" } });
	} catch {
		return new Response("dashboard_unavailable", { status: 503, headers: { "cache-control": "no-store" } });
	}
}

function wantsJson(request: Request): boolean {
	const url = new URL(request.url);
	return url.searchParams.get("format") === "json" || request.headers.get("accept")?.includes("application/json") === true;
}

export function metricsResponse(metrics: MatchMetrics): DashboardMetricsResponse {
	return {
		schemaVersion: 1,
		measuredAt: metrics.measuredAt,
		counts: {
			allTime: metrics.allTime,
			now: metrics.now,
			paused: metrics.paused,
			sleeping: metrics.sleeping,
		},
		freshness: FRESHNESS,
	};
}

function isAuthorized(request: Request, secret: string | undefined): boolean {
	if (!secret) return false;
	const authorization = request.headers.get("authorization");
	if (authorization?.startsWith("Bearer ") && equalSecret(authorization.slice("Bearer ".length), secret)) return true;
	return isSessionToken(readCookie(request.headers.get("cookie"), DASHBOARD_COOKIE), secret);
}

async function login(request: Request, secret: string | undefined, publicBaseUrl?: string): Promise<Response> {
	if (!secret) return notFound();
	if (request.method === "GET") return new Response(renderLogin(publicBaseUrl), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
	if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, POST", "cache-control": "no-store" } });
	try {
		const password = await loginPassword(request);
		if (!password || !equalSecret(password, secret)) return notFound();
		const headers = { "set-cookie": sessionCookie(secret), "cache-control": "no-store" };
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

function logout(request: Request, secret: string | undefined): Response {
	if (!secret || !isAuthorized(request, secret)) return notFound();
	if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
	return Response.json({ ok: true }, { headers: { "set-cookie": `${DASHBOARD_COOKIE}=; Path=/operator; HttpOnly; Secure; SameSite=Strict; Max-Age=0`, "cache-control": "no-store" } });
}

function sessionToken(secret: string): string {
	const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
	const payload = `kore-operator-dashboard-session-v1.${expiresAt}`;
	return `${expiresAt}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

function sessionCookie(secret: string): string {
	return `${DASHBOARD_COOKIE}=${sessionToken(secret)}; Path=/operator; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
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

function renderDashboard(metrics: DashboardMetricsResponse): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>KORE operator dashboard</title></head><body><main><h1>KORE operator dashboard</h1><dl><dt>All-time matches</dt><dd data-metric="allTime">${metrics.counts.allTime}</dd><dt>Matches now</dt><dd data-metric="now">${metrics.counts.now}</dd><dt>Paused matches</dt><dd data-metric="paused">${metrics.counts.paused}</dd><dt>Sleeping matches</dt><dd data-metric="sleeping">${metrics.counts.sleeping}</dd><dt>Measured at</dt><dd data-metric="measuredAt">${metrics.measuredAt}</dd></dl><p data-freshness="metrics">${metrics.freshness}</p></main></body></html>`;
}

export function dashboardUrl(publicBaseUrl: string | undefined, path: string): string {
	if (!publicBaseUrl) return path;
	const base = new URL(publicBaseUrl);
	base.search = "";
	base.hash = "";
	if (!base.pathname.endsWith("/")) base.pathname += "/";
	return new URL(path.replace(/^\//, ""), base).toString();
}

function renderLogin(publicBaseUrl?: string): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>KORE operator login</title></head><body><main><h1>KORE operator login</h1><form method="post" action="${dashboardUrl(publicBaseUrl, DASHBOARD_LOGIN_PATH)}"><label>Password <input type="password" name="password" autocomplete="current-password" required></label><button type="submit">Sign in</button></form></main></body></html>`;
}
