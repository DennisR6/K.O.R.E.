import type { GameHandler } from "../engine/Handler.js";
import { GameState } from "../engine/types.js";
import type { FeedbackMode } from "../server/feedback.js";

export type FeedbackContext = { gameId?: string; userId?: string; mode: FeedbackMode; mapId?: string };

export function buildFeedbackEndpoint(baseUrl: string): string {
	if (!baseUrl) return "";
	const url = new URL(baseUrl);
	if (url.protocol === "ws:") url.protocol = "http:";
	if (url.protocol === "wss:") url.protocol = "https:";
	const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
	url.pathname = `${path}api/feedback`;
	url.search = "";
	url.hash = "";
	return url.toString();
}

export function installFeedbackPrompt(handler: GameHandler, context: FeedbackContext, endpoint: string, promptImpl: ((message?: string, defaultValue?: string) => string | null) | undefined = globalThis.prompt): void {
	let asked = false;
	handler.addPostDrawer({
		draw: () => {
			if (handler.getState() !== GameState.Game_over) {
				asked = false;
				return;
			}
			if (asked || typeof promptImpl !== "function") return;
			asked = true;
			const text = promptImpl("How was the match? Your feedback helps us improve.")?.trim();
			if (text) void reportFeedback(context, text, endpoint);
		},
	});
}

export async function reportFeedback(context: FeedbackContext, text: string, endpoint: string, fetchImpl: typeof fetch = globalThis.fetch): Promise<boolean> {
	if (!endpoint || typeof fetchImpl !== "function") return false;
	try {
		const response = await fetchImpl(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...context, text }) });
		return response.ok;
	} catch {
		return false;
	}
}
