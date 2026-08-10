import type { GameDatabase } from "./db.js";
import { validateMatchPerformanceReport } from "../performance/matchPerformance.js";

export const PERFORMANCE_REPORT_PATH_PREFIX = "/api/games/";
const MAX_REPORT_BYTES = 1_000_000;

/** Stores one authenticated game member's aggregated performance report. */
export async function servePerformanceReport(request: Request, database: GameDatabase): Promise<Response | undefined> {
	const url = new URL(request.url);
	const match = url.pathname.match(/^\/api\/games\/([^/]+)\/performance$/);
	if (!match) return undefined;
	if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
	const body = await request.text();
	if (body.length > MAX_REPORT_BYTES) return new Response("Performance report too large", { status: 413, headers: { "cache-control": "no-store" } });
	try {
		const parsed = JSON.parse(body) as unknown;
		validateMatchPerformanceReport(parsed);
		if (parsed.gameId !== decodeURIComponent(match[1]!)) return new Response("Game ID does not match the route", { status: 400, headers: { "cache-control": "no-store" } });
		const stored = database.storePerformanceReport(parsed);
		return Response.json({ ok: true, id: stored.id, updatedAt: stored.updatedAt }, { headers: { "cache-control": "no-store" } });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Invalid performance report";
		const status = message === "Unknown game" ? 404 : message.includes("does not belong") ? 403 : message.includes("completed game") ? 409 : 400;
		return new Response(status === 400 ? "Invalid performance report" : message, { status, headers: { "cache-control": "no-store" } });
	}
}
