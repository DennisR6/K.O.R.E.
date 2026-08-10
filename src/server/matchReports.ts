import type { GameDatabase } from "./db.js";

const MAX_REPORT_BYTES = 4_000;

/** HTTP fallback for clients whose online WebSocket is temporarily unavailable. */
export async function serveMatchReport(request: Request, database: GameDatabase): Promise<Response | undefined> {
	const match = new URL(request.url).pathname.match(/^\/api\/games\/([^/]+)\/report$/);
	if (!match) return undefined;
	if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
	const body = await request.text();
	if (body.length > MAX_REPORT_BYTES) return new Response("Report too large", { status: 413 });
	try {
		const value = JSON.parse(body) as { gameId?: unknown; userId?: unknown; category?: unknown; text?: unknown };
		const gameId = decodeURIComponent(match[1]!);
		if (value.gameId !== gameId || typeof value.userId !== "string" || (value.category !== "conduct" && value.category !== "technical") || typeof value.text !== "string" || value.text.trim().length < 1 || value.text.length > 500) return new Response("Invalid report", { status: 400 });
		if (!database.hasGame(gameId)) return new Response("Unknown game", { status: 404 });
		const member = database.loadGame(gameId)?.users.includes(value.userId) ?? false;
		if (!member) return new Response("User does not belong to this game", { status: 403 });
		const id = database.createMatchReport(gameId, value.userId, value.category, value.text.trim(), database.getGameTurnNumber(gameId));
		return Response.json({ ok: true, reportId: id }, { headers: { "cache-control": "no-store" } });
	} catch (error) {
		return new Response(error instanceof Error && error.message.includes("UNIQUE") ? "Report already submitted" : "Invalid report", { status: 400 });
	}
}
