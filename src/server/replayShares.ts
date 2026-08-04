import type { GameRegistry } from "./gameRegistry.js";

const TOKEN = /^[a-f0-9]{32}$/;

/** Exact anonymous read-only replay endpoint with a deliberately uniform error. */
export function servePublicReplayShare(request: Request, registry: GameRegistry): Response | undefined {
	const url = new URL(request.url);
	const match = /^\/replays\/([a-f0-9]{32})$/.exec(url.pathname);
	if (!url.pathname.startsWith("/replays/")) return undefined;
	if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { allow: "GET" } });
	const token = match?.[1];
	if (!token || !TOKEN.test(token)) return new Response("Replay unavailable", { status: 404 });
	const share = registry.getDatabase().getPublicReplayShare(token);
	if (share) return Response.json({ version: 1, token: share.token, createdAt: share.createdAt, replay: share.replay }, { headers: { "cache-control": "no-store" } });
	const operatorView = registry.getDatabase().getPublicOperatorReplayView(token);
	if (!operatorView) return new Response("Replay unavailable", { status: 404 });
	return Response.json({ version: 1, token: operatorView.token, updatedAt: operatorView.updatedAt, replay: operatorView.replay }, { headers: { "cache-control": "no-store" } });
}
