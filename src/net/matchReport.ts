import type { KoreReportCategory } from "../kore/ui/hudCommands.js";

export function buildMatchReportEndpoint(baseUrl: string, gameId: string): string {
	if (!baseUrl) return "";
	const url = new URL(baseUrl);
	if (url.protocol === "ws:") url.protocol = "http:";
	if (url.protocol === "wss:") url.protocol = "https:";
	const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
	url.pathname = `${path}api/games/${encodeURIComponent(gameId)}/report`;
	url.search = ""; url.hash = "";
	return url.toString();
}

export async function reportMatchHttp(endpoint: string, gameId: string, userId: string, category: KoreReportCategory, text: string, fetchImpl: typeof fetch = globalThis.fetch): Promise<boolean> {
	if (!endpoint || typeof fetchImpl !== "function") return false;
	try {
		const response = await fetchImpl(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ gameId, userId, category, text }) });
		return response.ok;
	} catch { return false; }
}
