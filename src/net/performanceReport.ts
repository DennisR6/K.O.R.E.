import type { GameHandler } from "../kore/runtime/Handler.js";
import { GameState } from "../kore/runtime/types.js";
import { aggregatePerformanceLogs, type MatchPerformanceReport, type PerformanceClientMetadata } from "../performance/matchPerformance.js";

export function buildPerformanceEndpoint(baseUrl: string, gameId: string): string {
	if (!baseUrl) return "";
	const url = new URL(baseUrl);
	if (url.protocol === "ws:") url.protocol = "http:";
	if (url.protocol === "wss:") url.protocol = "https:";
	const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
	url.pathname = `${path}api/games/${encodeURIComponent(gameId)}/performance`;
	url.search = "";
	url.hash = "";
	return url.toString();
}

export function collectMatchPerformanceReport(handler: GameHandler, gameId: string, userId: string, options: { engineVersion?: string; client?: PerformanceClientMetadata } = {}): MatchPerformanceReport {
	return aggregatePerformanceLogs(handler.getLogs(), { gameId, userId, ...options });
}

/** Reports one completed online match; failures never affect gameplay or replay. */
export function installMatchPerformanceReport(handler: GameHandler, gameId: string, userId: string, reporter?: (report: MatchPerformanceReport) => void | Promise<void>, endpoint?: string): void {
	let reported = false;
	handler.addPostDrawer({
		draw: () => {
			if (handler.getState() !== GameState.Game_over) { reported = false; return; }
			if (reported) return;
			reported = true;
			const report = collectMatchPerformanceReport(handler, gameId, userId);
			void Promise.resolve(reporter === undefined ? reportMatchPerformance(report, { endpoint }) : reporter(report));
		},
	});
}

export async function reportMatchPerformance(report: MatchPerformanceReport, options: { endpoint?: string; fetchImpl?: typeof fetch } = {}): Promise<boolean> {
	const endpoint = options.endpoint ?? buildPerformanceEndpoint(globalThis.location?.href ?? globalThis.location?.origin ?? "", report.gameId);
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== "function" || !endpoint || endpoint === "/") return false;
	try {
		const response = await fetchImpl(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(report) });
		return response.ok;
	} catch {
		return false;
	}
}
