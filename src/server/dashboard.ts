import { timingSafeEqual } from "node:crypto";
import type { GameRegistry } from "./gameRegistry.js";
import type { MatchMetrics } from "./types.js";

export const DASHBOARD_METRICS_PATH = "/operator/dashboard/metrics";
export const DASHBOARD_PATH = "/operator/dashboard";
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
	return pathname === DASHBOARD_PATH || pathname === DASHBOARD_METRICS_PATH;
}

/**
 * Handles the two exact operator routes. `/operator/dashboard?format=json`
 * serves the complete dashboard payload as JSON while retaining the same
 * authentication and no-store policy as the HTML representation. Undefined means the caller should
 * continue normal routing; disabled or unauthorized dashboard paths are an
 * indistinguishable not-found response to avoid endpoint discovery.
 */
export function serveDashboard(request: Request, registry: Pick<GameRegistry, "getMetrics">, config: DashboardConfig): Response | undefined {
	const pathname = new URL(request.url).pathname;
	if (!isDashboardPath(pathname)) return undefined;
	if (!isAuthorized(request, config.operatorSecret)) return notFound();
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
	if (!authorization?.startsWith("Bearer ")) return false;
	const supplied = authorization.slice("Bearer ".length);
	const expectedBytes = Buffer.from(secret);
	const suppliedBytes = Buffer.from(supplied);
	return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

function notFound(): Response {
	return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
}

function renderDashboard(metrics: DashboardMetricsResponse): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>KORE operator dashboard</title></head><body><main><h1>KORE operator dashboard</h1><dl><dt>All-time matches</dt><dd data-metric="allTime">${metrics.counts.allTime}</dd><dt>Matches now</dt><dd data-metric="now">${metrics.counts.now}</dd><dt>Paused matches</dt><dd data-metric="paused">${metrics.counts.paused}</dd><dt>Sleeping matches</dt><dd data-metric="sleeping">${metrics.counts.sleeping}</dd><dt>Measured at</dt><dd data-metric="measuredAt">${metrics.measuredAt}</dd></dl><p data-freshness="metrics">${metrics.freshness}</p></main></body></html>`;
}
