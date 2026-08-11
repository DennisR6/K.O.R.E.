import type { GameHandler } from "../engine/Handler.js";
import { GameState } from "../engine/types.js";
import type { FeedbackMode } from "../server/feedback.js";

export type FeedbackContext = { gameId?: string; userId?: string; mode: FeedbackMode; mapId?: string };
export type FeedbackPrompt = (message?: string, defaultValue?: string) => string | null;
export type FeedbackTopic = "bug" | "balance" | "controls" | "other";

export function buildDesyncFeedbackText(log: { type: string; turnNumber: number; data: unknown }): string {
	const details = JSON.stringify(log.data);
	return `Automatic network desync detected. turn=${log.turnNumber}; event=${log.type}; details=${details}`.slice(0, 2_000);
}

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

export function installFeedbackPrompt(handler: GameHandler, context: FeedbackContext, endpoint: string, promptImpl: FeedbackPrompt | undefined = globalThis.prompt): void {
	let asked = false;
	handler.addPostDrawer({
		draw: () => {
			if (handler.getState() !== GameState.Game_over) {
				asked = false;
				return;
			}
			if (asked || typeof promptImpl !== "function") return;
			asked = true;
			const text = promptImpl("How was the match? Tell us what helped or blocked you.")?.trim();
			if (!text) return;
			const rawTopic = promptImpl("What should we improve? Enter bug, balance, controls, or other. Optional: cancel to skip.")?.trim().toLowerCase();
			const topic: FeedbackTopic | undefined = rawTopic === "bug" || rawTopic === "balance" || rawTopic === "controls" || rawTopic === "other" ? rawTopic : undefined;
			const rawRating = promptImpl("Rate this match from 1 (poor) to 5 (great). Optional: cancel to skip.")?.trim();
			const parsedRating = rawRating === undefined || rawRating === "" ? undefined : Number(rawRating);
			const rating = parsedRating !== undefined && Number.isSafeInteger(parsedRating) && parsedRating >= 1 && parsedRating <= 5 ? parsedRating : undefined;
			void reportFeedback(context, text, endpoint, globalThis.fetch, rating, topic);
		},
	});
}

export function installDesyncFeedbackReporter(handler: GameHandler, context: FeedbackContext, endpoint: string): void {
	const reported = new Set<string>();
	handler.addPostDrawer({
		draw: () => {
			for (const log of handler.getLogs()) {
				if (log.type !== "turnPacket.hash-mismatch" && log.type !== "turnPacket.stale") continue;
				const key = `${log.type}:${log.turnNumber}:${JSON.stringify(log.data)}`;
				if (reported.has(key)) continue;
				reported.add(key);
				void reportFeedback(context, buildDesyncFeedbackText(log), endpoint, globalThis.fetch, undefined, "bug");
			}
		},
	});
}

export async function reportFeedback(context: FeedbackContext, text: string, endpoint: string, fetchImpl: typeof fetch = globalThis.fetch, rating?: number, topic?: FeedbackTopic): Promise<boolean> {
	if (!endpoint || typeof fetchImpl !== "function") return false;
	try {
		const response = await fetchImpl(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...context, text, ...(topic === undefined ? {} : { topic }), ...(rating === undefined ? {} : { rating }) }) });
		return response.ok;
	} catch {
		return false;
	}
}
