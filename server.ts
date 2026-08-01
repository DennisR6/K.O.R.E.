import { ServerRuntime, type ServerSocket } from "./src/server/runtime.ts";
import { GameDatabase } from "./src/server/db.ts";
import { GameRegistry } from "./src/server/gameRegistry.ts";
import type { WebSocketData } from "./src/server/types.ts";

const PORT = Number(process.env.PORT ?? 3000);
const database = new GameDatabase(process.env.GAME_DB_PATH ?? "./data/kore.db");
const runtime = new ServerRuntime(new GameRegistry(database));

Bun.serve<WebSocketData>({
	port: PORT,
	async fetch(req, server) {
		if (server.upgrade(req, { data: { connectionId: crypto.randomUUID() } })) return;

		const url = new URL(req.url);
		const file = Bun.file(`.${url.pathname}`);
		const exists = await file.exists();
		const logLine = `[REQ] ${req.method} ${url.pathname} | cwd: ${process.cwd()} | name: ${file.name} | exists: ${exists}\n`;
		await Bun.write("server_log.txt", logLine, { append: true });
		if (url.pathname.includes(".db") || url.pathname.includes("..")) return new Response("Forbidden", { status: 403 });
		if (url.pathname === "/") return new Response(Bun.file("./index.html"));
		// The offline shell lives in public/ but must register at root scope.
		if (url.pathname === "/sw.js") return new Response(Bun.file("./public/sw.js"));
		if (url.pathname.startsWith("/public/") || url.pathname.startsWith("/dist/")) {
			if (!exists) {
				if (url.pathname.endsWith(".mp3")) {
					return new Response(new Uint8Array(0), { headers: { "Content-Type": "audio/mpeg" } });
				}
				await Bun.write("server_log.txt", `[ERR] File not found: ${url.pathname}\n`, { append: true });
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
console.log(`Server running on http://localhost:${PORT}`);
