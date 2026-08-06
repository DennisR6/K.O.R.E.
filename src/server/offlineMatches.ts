import type { GameDatabase } from "./db.js";
import { validateOfflineMatchReport } from "./offlineMatchContract.js";

export const OFFLINE_MATCHES_PATH = "/offline-matches";
const MAX_REPORT_BYTES = 2_000_000;

/**
 * Accepts completed offline/KI match reports uploaded by the browser. Every
 * body is structurally validated (mode/map header, seed, players, result, and
 * a replay document with a pristine origin) before it reaches the SQLite
 * store, so untrusted uploads can never inject executable or foreign data.
 */
export async function serveOfflineMatchReport(request: Request, database: GameDatabase): Promise<Response | undefined> {
	const url = new URL(request.url);
	if (url.pathname !== OFFLINE_MATCHES_PATH) return undefined;
	if (request.method !== "POST") {
		return new Response("Method not allowed", { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
	}
	const bodyText = await request.text();
	if (bodyText.length > MAX_REPORT_BYTES) {
		return new Response("Offline match report too large", { status: 413, headers: { "cache-control": "no-store" } });
	}
	try {
		const body = JSON.parse(bodyText) as unknown;
		validateOfflineMatchReport(body);
		const stored = database.storeOfflineMatch(body);
		console.log(`Stored offline match ${stored.id} (${stored.mode} on ${stored.mapId}, ${stored.players.join(" vs ")})`);
		return Response.json({ ok: true, id: stored.id }, { headers: { "cache-control": "no-store" } });
	} catch (error) {
		console.warn(`Rejected offline match report: ${error instanceof Error ? error.message : "invalid payload"}`);
		return new Response("Invalid offline match report", { status: 400, headers: { "cache-control": "no-store" } });
	}
}