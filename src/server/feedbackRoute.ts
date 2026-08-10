import type { GameDatabase } from "./db.js";
import { validateFeedbackSubmission } from "./feedback.js";

const MAX_FEEDBACK_BYTES = 8_000;

export async function serveFeedback(request: Request, database: GameDatabase): Promise<Response | undefined> {
	if (new URL(request.url).pathname !== "/api/feedback") return undefined;
	if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
	const body = await request.text();
	if (body.length > MAX_FEEDBACK_BYTES) return new Response("Feedback too large", { status: 413 });
	try {
		const value = JSON.parse(body) as unknown;
		validateFeedbackSubmission(value);
		if (value.gameId) {
			if (!value.userId || !database.loadGame(value.gameId)?.users.includes(value.userId)) return new Response("User does not belong to this game", { status: 403 });
		}
		const stored = database.storeFeedback(value);
		return Response.json({ ok: true, id: stored.id }, { headers: { "cache-control": "no-store" } });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Invalid feedback";
		return new Response(message === "Invalid feedback" ? message : "Invalid feedback", { status: 400, headers: { "cache-control": "no-store" } });
	}
}
