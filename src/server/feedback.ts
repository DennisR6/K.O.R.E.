export type FeedbackMode = "online" | "hotseat" | "human-vs-ai" | "ai-battle";

export type FeedbackSubmission = {
	gameId?: string;
	userId?: string;
	mode?: FeedbackMode;
	mapId?: string;
	text: string;
};

export function validateFeedbackSubmission(value: unknown): asserts value is FeedbackSubmission {
	if (!value || typeof value !== "object") throw new Error("Invalid feedback");
	const input = value as Record<string, unknown>;
	if (typeof input.text !== "string" || input.text.trim().length < 1 || input.text.length > 2_000) throw new Error("Invalid feedback text");
	if (input.gameId !== undefined && (typeof input.gameId !== "string" || input.gameId.length < 1 || input.gameId.length > 120)) throw new Error("Invalid feedback game");
	if (input.userId !== undefined && (typeof input.userId !== "string" || input.userId.length < 1 || input.userId.length > 120)) throw new Error("Invalid feedback user");
	if (input.mode !== undefined && input.mode !== "online" && input.mode !== "hotseat" && input.mode !== "human-vs-ai" && input.mode !== "ai-battle") throw new Error("Invalid feedback mode");
	if (input.mapId !== undefined && (typeof input.mapId !== "string" || input.mapId.length < 1 || input.mapId.length > 120)) throw new Error("Invalid feedback map");
}
