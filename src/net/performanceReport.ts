import type { GameHandler } from "../engine/Handler.js";
import { GameState } from "../engine/types.js";
import { aggregatePerformanceLogs, type MatchPerformanceReport, type PerformanceClientMetadata } from "../performance/matchPerformance.js";

export function buildPerformanceEndpoint(origin: string, gameId: string): string {
	return `${origin.replace(/\/+$/, "")}/api/games/${encodeURIComponent(gameId)}/performance`;
}

export function collectMatchPerformanceReport(handler: GameHandler, gameId: string, userId: string, options: { engineVersion?: string; client?: PerformanceClientMetadata } = {}): MatchPerformanceReport {
	return aggregatePerformanceLogs(handler.getLogs(), { gameId, userId, ...options });
}

/** Reports one completed online match; failures never affect gameplay or replay. */
export function installMatchPerformanceReport(handler: GameHandler, gameId: string, userId: string, reporter: (report: MatchPerformanceReport) => void | Promise<void> = report => { void reportMatchPerformance(report); }): void {
	let reported = false;
	handler.addPostDrawer({
		draw: () => {
			if (handler.getState() !== GameState.Game_over) { reported = false; return; }
			if (reported) return;
			reported = true;
		void Promise.resolve(reporter(collectMatchPerformanceReport(handler, gameId, userId)));
		},
	});
}

export async function reportMatchPerformance(report: MatchPerformanceReport, options: { endpoint?: string; fetchImpl?: typeof fetch } = {}): Promise<boolean> {
	const endpoint = options.endpoint ?? buildPerformanceEndpoint(globalThis.location?.origin ?? "", report.gameId);
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== "function" || !endpoint || endpoint === "/") return false;
	try {
		const response = await fetchImpl(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(report) });
		return response.ok;
	} catch {
		return false;
	}
}
