import { ServerRuntime, type ServerSocket } from "./src/server/runtime.ts";
import { GameDatabase } from "./src/server/db.ts";
import { GameRegistry } from "./src/server/gameRegistry.ts";
import type { WebSocketData } from "./src/server/types.ts";

const PORT = Number(process.env.PORT ?? 3000);
const database = new GameDatabase(process.env.GAME_DB_PATH ?? "./data/kore.db");
const runtime = new ServerRuntime(new GameRegistry(database));

Bun.serve<WebSocketData>({
	port: PORT,
	fetch(req, server) {
		if (server.upgrade(req, { data: { connectionId: crypto.randomUUID() } })) return;

		const url = new URL(req.url);
		if (url.pathname === "/") return new Response(Bun.file("./index.html"));
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
console.log(`Server running on http://localhost:${PORT}`);
