import { createHmac, timingSafeEqual } from "node:crypto";
import type { GameDatabase, OperatorReplaySummary } from "./db.js";
import type { GameRegistry } from "./gameRegistry.js";
import type { MatchMetrics } from "./types.js";

export const DASHBOARD_METRICS_PATH = "/operator/dashboard/metrics";
export const DASHBOARD_PATH = "/operator/dashboard";
export const DASHBOARD_LOGIN_PATH = "/operator/login";
export const DASHBOARD_LOGOUT_PATH = "/operator/logout";
export const DASHBOARD_DATABASE_PATH = "/operator/db";
export const DASHBOARD_REPLAYS_PATH = "/operator/replays";
const DASHBOARD_COOKIE = "kore_operator_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const FRESHNESS = "allTime, playersAllTime, playersOnline, paused, and sleeping are durable SQLite aggregates; playersOnline includes every player whose game is not sleeping; now is scoped to this server process's resident registry cache.";

export type DashboardConfig = { operatorSecret: string | undefined };

export type DashboardMetricsResponse = {
  schemaVersion: 1;
  measuredAt: number;
  counts: Pick<MatchMetrics, "allTime" | "playersAllTime" | "playersOnline" | "now" | "paused" | "sleeping">;
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
  return pathname === DASHBOARD_PATH || pathname === DASHBOARD_METRICS_PATH || pathname === DASHBOARD_LOGIN_PATH || pathname === DASHBOARD_LOGOUT_PATH || pathname === DASHBOARD_DATABASE_PATH || pathname === DASHBOARD_REPLAYS_PATH || pathname.startsWith(`${DASHBOARD_REPLAYS_PATH}/`);
}

/**
 * Handles the two exact operator routes. `/operator/dashboard?format=json`
 * serves the complete dashboard payload as JSON while retaining the same
 * authentication and no-store policy as the HTML representation. Undefined means the caller should
 * continue normal routing; disabled or unauthorized dashboard paths are an
 * indistinguishable not-found response to avoid endpoint discovery.
 */
export async function serveDashboard(request: Request, registry: Pick<GameRegistry, "getMetrics">, config: DashboardConfig, database?: Pick<GameDatabase, "exportSnapshot" | "listOperatorReplays" | "getOperatorReplay" | "createOperatorReplayView">, publicBaseUrl?: string): Promise<Response | undefined> {
  const url = new URL(request.url); const pathname = url.pathname;
  if (!isDashboardPath(pathname)) return undefined;
  if (pathname === DASHBOARD_LOGIN_PATH) return login(request, config.operatorSecret, publicBaseUrl);
  if (pathname === DASHBOARD_LOGOUT_PATH) return logout(request, config.operatorSecret, publicBaseUrl);
  if (!isAuthorized(request, config.operatorSecret)) return notFound();
  if (pathname === DASHBOARD_DATABASE_PATH) return databaseDownload(request, database);
  if (pathname === DASHBOARD_REPLAYS_PATH || pathname.startsWith(`${DASHBOARD_REPLAYS_PATH}/`)) return operatorReplays(request, database, pathname, url.searchParams.get("id"), publicBaseUrl);
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

function operatorReplays(request: Request, database: Pick<GameDatabase, "listOperatorReplays" | "getOperatorReplay" | "createOperatorReplayView"> | undefined, pathname: string, requestedGameId: string | null, publicBaseUrl?: string): Response {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { allow: "GET", "cache-control": "no-store" } });
  if (!database) return new Response("dashboard_unavailable", { status: 503, headers: { "cache-control": "no-store" } });
  try {
    const suffix = pathname.slice(DASHBOARD_REPLAYS_PATH.length).replace(/^\//, "");
    const segments = suffix.split("/");
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
    return new Response(renderReplayDashboard(body, publicBaseUrl), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
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
      playersAllTime: metrics.playersAllTime,
      playersOnline: metrics.playersOnline,
      now: metrics.now,
      paused: metrics.paused,
      sleeping: metrics.sleeping,
    },
    mapUsage: metrics.mapUsage.map(metric => ({ ...metric })),
    mostPlayedMap: metrics.mostPlayedMap && { ...metrics.mostPlayedMap },
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

function renderDashboard(metrics: DashboardMetricsResponse): string {
  const mostPlayed = metrics.mostPlayedMap ? `${metrics.mostPlayedMap.mapId} (${metrics.mostPlayedMap.games} games, ${metrics.mostPlayedMap.percentage}%)` : "No matches yet";
  const rows = metrics.mapUsage.map(metric => `<tr><td>${metric.mapId}</td><td>${metric.games}</td><td>${metric.percentage}%</td></tr>`).join("") || "<tr><td colspan=\"3\">No matches yet</td></tr>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>KORE operator dashboard</title><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/mini.css/3.0.1/mini-default.min.css"></head><body><main><h1>KORE operator dashboard</h1><p><a href="replays">Replay archive</a></p><dl><dt>All-time matches</dt><dd data-metric="allTime">${metrics.counts.allTime}</dd><dt>All-time players</dt><dd data-metric="playersAllTime">${metrics.counts.playersAllTime}</dd><dt>Players online</dt><dd data-metric="playersOnline">${metrics.counts.playersOnline}</dd><dt>Matches now</dt><dd data-metric="now">${metrics.counts.now}</dd><dt>Paused matches</dt><dd data-metric="paused">${metrics.counts.paused}</dd><dt>Sleeping matches</dt><dd data-metric="sleeping">${metrics.counts.sleeping}</dd><dt>Most played map</dt><dd data-metric="mostPlayedMap">${mostPlayed}</dd><dt>Measured at</dt><dd data-metric="measuredAt">${metrics.measuredAt}</dd></dl><table><caption>Map usage</caption><thead><tr><th>Map</th><th>Games</th><th>Share</th></tr></thead><tbody data-metric="mapUsage">${rows}</tbody></table><p data-freshness="metrics">${metrics.freshness}</p></main></body></html>`;
}

function renderReplayDashboard(response: DashboardReplayIndexResponse, publicBaseUrl?: string): string {
  const filter = response.filter.gameId ?? "";
  const rows = response.replays.map(replay => {
    const encodedId = encodeURIComponent(replay.gameId);
    const downloadUrl = dashboardUrl(publicBaseUrl, `${DASHBOARD_REPLAYS_PATH}/${encodedId}`);
    const viewUrl = dashboardUrl(publicBaseUrl, `${DASHBOARD_REPLAYS_PATH}/${encodedId}/view`);
    return `<tr><td>${escapeHtml(replay.gameId)}</td><td>${escapeHtml(replay.status)}</td><td>${replay.updatedAt}</td><td>${replay.actionCount}</td><td><a href="${escapeHtml(viewUrl)}">View replay</a> <a href="${escapeHtml(downloadUrl)}">Download</a></td></tr>`;
  }).join("") || "<tr><td colspan=\"5\">No replay found</td></tr>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>KORE replay archive</title><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/mini.css/3.0.1/mini-default.min.css"></head><body><main><h1>KORE replay archive</h1><p><a href="${dashboardUrl(publicBaseUrl, DASHBOARD_PATH)}">Dashboard</a></p><form method="get"><label>Match ID <input name="id" value="${escapeHtml(filter)}" autocomplete="off"></label><button type="submit">Filter</button></form><table><caption>Persisted match replays</caption><thead><tr><th>Match ID</th><th>Status</th><th>Updated</th><th>Actions</th><th>Replay</th></tr></thead><tbody data-replays="index">${rows}</tbody></table></main></body></html>`;
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>KORE operator login</title><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/mini.css/3.0.1/mini-default.min.css"></head><body><main><h1>KORE operator login</h1><form method="post" action="${dashboardUrl(publicBaseUrl, DASHBOARD_LOGIN_PATH)}"><label>Password <input type="password" name="password" autocomplete="current-password" required></label><button type="submit">Sign in</button></form></main></body></html>`;
}
