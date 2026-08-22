import { ServerRuntime, type ServerSocket } from "./src/server/runtime.ts";
import { GameDatabase } from "./src/server/db.ts";
import { GameRegistry } from "./src/server/gameRegistry.ts";
import { readServerConfig, resolveGameDatabasePath, serveConfig } from "./src/server/config.ts";
import { readDashboardConfig, serveDashboard } from "./src/server/dashboard.ts";
import { servePublicReplayShare } from "./src/server/replayShares.ts";
import { serveOfflineMatchReport } from "./src/server/offlineMatches.ts";
import { servePerformanceReport } from "./src/server/performanceReports.ts";
import { serveMatchReport } from "./src/server/matchReports.ts";
import { serveFeedback } from "./src/server/feedbackRoute.ts";
import { serveDebugAssets } from "./src/server/debugAssets.ts";
import { join } from "node:path";
import { RankedService } from "./src/server/rankedService.ts";
import type { WebSocketData } from "./src/server/types.ts";

const PORT = Number(process.env.PORT ?? 3000);
// KORE_BASE_URL (default https://lupricht.net/kore/) is the public base URL the
// browser menu uses to join online matches; it is published via `/config`.
const serverConfig = readServerConfig(process.env);
// Set KORE_DASHBOARD_OPERATOR_SECRET through the deployment secret store, not .env.
const dashboardConfig = readDashboardConfig(process.env);
const databasePath = resolveGameDatabasePath(process.env, import.meta.dir);
const database = new GameDatabase(databasePath);
const rankedService = process.env.KORE_PLAYER_SESSION_SECRET
	? new RankedService(database, { id: process.env.KORE_RANKED_SEASON_ID ?? "ranked-2026", rulesetVersion: "ranked-v1", startsAt: 0, endsAt: null, status: "active" })
	: undefined;
const registry = new GameRegistry(database, 60_000, rankedService);
const runtime = new ServerRuntime(registry, undefined, process.env.KORE_ROAST_PACKED_INIT === "1", process.env.KORE_PLAYER_SESSION_SECRET, rankedService);
const debugAssetRoot = join(import.meta.dir, "data", "debug-assets");

Bun.serve<WebSocketData>({
  port: PORT,
  async fetch(req, server) {
    if (server.upgrade(req, { data: { connectionId: crypto.randomUUID() } })) return;

		const url = new URL(req.url);
		if (url.pathname.includes(".db") || url.pathname.includes("..")) return new Response("Forbidden", { status: 403 });
		const dashboard = await serveDashboard(req, runtime.getRegistry(), dashboardConfig, database, serverConfig.baseUrl);
		if (dashboard) return dashboard;
		const debugAssets = await serveDebugAssets(req, database, dashboardConfig.operatorSecret, debugAssetRoot, serverConfig.baseUrl);
		if (debugAssets) return debugAssets;
		const replay = servePublicReplayShare(req, runtime.getRegistry());
		if (replay) return replay;
		const offline = await serveOfflineMatchReport(req, database);
		if (offline) return offline;
		const performance = await servePerformanceReport(req, database);
		if (performance) return performance;
		const matchReport = await serveMatchReport(req, database);
		if (matchReport) return matchReport;
		const feedback = await serveFeedback(req, database);
		if (feedback) return feedback;
		if (url.pathname === "/config") return serveConfig(serverConfig);
		if (url.pathname === "/") return new Response(Bun.file("./index.html"));
		if (url.pathname === "/replay.html") return new Response(Bun.file("./replay.html"));
		// The offline shell lives in public/ but must register at root scope.
		if (url.pathname === "/sw.js") return new Response(Bun.file("./public/sw.js"));
		if (url.pathname.startsWith("/public/") || url.pathname.startsWith("/dist/")) {
			const file = Bun.file(`.${url.pathname}`);
			if (!(await file.exists())) {
				// Audio is an optional ignored asset in source checkouts. Returning
				// no content keeps browser audio probing quiet without hiding other
				// missing public resources behind a successful response.
				if (url.pathname.startsWith("/public/audio/")) return new Response(null, { status: 204 });
				return new Response("Not found", { status: 404 });
			}
			return new Response(file);
		}
		return new Response("Not found", { status: 404 });
	},
	websocket: {
		open(ws) { runtime.open(ws as unknown as ServerSocket); },
		message(ws, message) { runtime.message(ws as unknown as ServerSocket, String(message)); },
		close(ws) { runtime.close(ws as unknown as ServerSocket); },
	},
});

setInterval(() => runtime.matchmakeOnce(), 250);
console.log(`Server running on http://localhost:${PORT} (KORE_BASE_URL=${serverConfig.baseUrl}, GAME_DB_PATH=${databasePath})`);
