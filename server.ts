import { ServerRuntime, type ServerSocket } from "./src/server/runtime.ts";
import { GameDatabase } from "./src/server/db.ts";
import { GameRegistry } from "./src/server/gameRegistry.ts";
import { readServerConfig, serveConfig } from "./src/server/config.ts";
import { readDashboardConfig, serveDashboard } from "./src/server/dashboard.ts";
import { servePublicReplayShare } from "./src/server/replayShares.ts";
import type { WebSocketData } from "./src/server/types.ts";

const PORT = Number(process.env.PORT ?? 3000);
// KORE_BASE_URL (default https://lupricht.net/kore/) is the public base URL the
// browser menu uses to join online matches; it is published via `/config`.
const serverConfig = readServerConfig(process.env);
// Set KORE_DASHBOARD_OPERATOR_SECRET through the deployment secret store, not .env.
const dashboardConfig = readDashboardConfig(process.env);
const database = new GameDatabase(process.env.GAME_DB_PATH ?? "./data/kore.db");
const runtime = new ServerRuntime(new GameRegistry(database));

Bun.serve<WebSocketData>({
	port: PORT,
	async fetch(req, server) {
		if (server.upgrade(req, { data: { connectionId: crypto.randomUUID() } })) return;

		const url = new URL(req.url);
		if (url.pathname.includes(".db") || url.pathname.includes("..")) return new Response("Forbidden", { status: 403 });
		const dashboard = await serveDashboard(req, runtime.getRegistry(), dashboardConfig, database);
		if (dashboard) return dashboard;
		const replay = servePublicReplayShare(req, runtime.getRegistry());
		if (replay) return replay;
		if (url.pathname === "/config") return serveConfig(serverConfig);
		if (url.pathname === "/") return new Response(Bun.file("./index.html"));
		// The offline shell lives in public/ but must register at root scope.
		if (url.pathname === "/sw.js") return new Response(Bun.file("./public/sw.js"));
		if (url.pathname.startsWith("/public/") || url.pathname.startsWith("/dist/")) {
			return new Response(Bun.file(`.${url.pathname}`));
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
console.log(`Server running on http://localhost:${PORT} (KORE_BASE_URL=${serverConfig.baseUrl})`);
