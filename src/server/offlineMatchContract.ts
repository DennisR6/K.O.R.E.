import type { MatchResult } from "../rules/types.js";
import type { ReplayDocument } from "../replay/types.js";
import { validateReplayDocument, validateReplayOrigin } from "../replay/types.js";

/** The supported offline match shapes; every mode starts through one pipeline. */
export type OfflineMatchMode = "hotseat" | "human-vs-ai" | "ai-battle";
export type OfflineMatchDifficulty = "easy" | "medium" | "hard";

/**
 * Completed offline match record (mode header + result + replay) uploaded by
 * the browser so offline/KI games land in the same queryable store as online
 * matches. `replay` must be a validated replay document with a pristine origin.
 */
export type OfflineMatchReport = {
	mode: OfflineMatchMode;
	mapId: string;
	difficulty?: OfflineMatchDifficulty;
	seed: number;
	players: string[];
	result: MatchResult;
	replay: ReplayDocument;
	performanceLogs?: unknown[];
};

/** Strict structural validation for untrusted browser uploads. */
export function validateOfflineMatchReport(value: unknown): asserts value is OfflineMatchReport {
	if (!isRecord(value) || !isOfflineMatchMode(value.mode) || typeof value.mapId !== "string" || !value.mapId) {
		throw new Error("Offline match reports require a mode and map id");
	}
	if (value.difficulty !== undefined && !isOfflineMatchDifficulty(value.difficulty)) throw new Error("Unknown offline match difficulty");
	if (typeof value.seed !== "number" || !Number.isSafeInteger(value.seed)) throw new Error("Offline match seed must be a safe integer");
	if (!Array.isArray(value.players) || value.players.length === 0 || !value.players.every(player => typeof player === "string" && player)) throw new Error("Offline match players must be non-empty team names");
	if (!isMatchResult(value.result)) throw new Error("Offline match result is invalid");
	validateReplayDocument(value.replay);
	validateReplayOrigin(value.replay);
	if (value.performanceLogs !== undefined && (!Array.isArray(value.performanceLogs) || value.performanceLogs.length > 10_000 || !value.performanceLogs.every(isJsonValue) || JSON.stringify(value.performanceLogs).length > 512_000)) throw new Error("Offline performance logs are invalid or too large");
}

function isMatchResult(value: unknown): value is MatchResult {
	if (!isRecord(value) || (value.status !== "winner" && value.status !== "draw")) return false;
	if (value.winnerTeam !== null && typeof value.winnerTeam !== "number") return false;
	if (value.reason !== "last-team-standing" && value.reason !== "draw") return false;
	return typeof value.turnNumber === "number" && Number.isSafeInteger(value.turnNumber) && value.turnNumber >= 0;
}

function isOfflineMatchMode(value: unknown): value is OfflineMatchMode {
	return value === "hotseat" || value === "human-vs-ai" || value === "ai-battle";
}

function isOfflineMatchDifficulty(value: unknown): value is OfflineMatchDifficulty {
	return value === "easy" || value === "medium" || value === "hard";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isJsonValue(value: unknown, depth = 0): boolean {
	if (depth > 12 || value === null || typeof value === "string" || typeof value === "boolean") return true;
	if (typeof value === "number") return Number.isFinite(value);
	if (Array.isArray(value)) return value.every(item => isJsonValue(item, depth + 1));
	if (typeof value !== "object") return false;
	return Object.entries(value).every(([key, item]) => key.length <= 200 && isJsonValue(item, depth + 1));
}
