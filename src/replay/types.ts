import { DOCUMENT_SCHEMA_VERSION, migrateDocument } from "../contracts/documents.js";
import type { ReplayDocument, ReplayAction } from "../contracts/documents.js";
import type { EngineSettings } from "../engine/types.js";
import type { MatchResult } from "../rules/types.js";

export type { ReplayDocument, ReplayAction };
/** Immutable authoritative artifact intentionally separate from a live match. */
export type FrozenReplayDocument = ReplayDocument & { finalSettings: EngineSettings; result: MatchResult; completedAt: number };
export { DOCUMENT_SCHEMA_VERSION, migrateDocument };

const SHOOT_ACTION_KEYS = ["type", "actorId", "input"] as const;
const ITEM_USE_ACTION_KEYS = ["type", "actorId", "itemId", "target"] as const;
const SHOOT_INPUT_KEYS = ["angle", "power"] as const;

export function validateReplayDocument(document: unknown): asserts document is ReplayDocument {
	if (!isRecord(document) || document.schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
		throw new Error("Invalid replay schema version");
	}
	if (!isRecord(document.initialSettings) || typeof document.seed !== "number" || !Number.isFinite(document.seed) || !Array.isArray(document.actions)) {
		throw new Error("Invalid replay document structure");
	}
	for (const action of document.actions) validateReplayAction(action);
}

export function validateFrozenReplayDocument(document: unknown): asserts document is FrozenReplayDocument {
	validateReplayDocument(document);
	const frozen = document as unknown as Record<string, unknown>;
	if (!isRecord(frozen.finalSettings) || !isRecord(frozen.result) || !Number.isSafeInteger(frozen.completedAt) || (frozen.completedAt as number) < 0) throw new Error("Invalid frozen replay document");
	if (frozen.finalSettings.state !== "GameState.Game_over" || !isRecord(frozen.finalSettings.matchResult)) throw new Error("Frozen replay must contain a completed final snapshot");
	if (JSON.stringify(frozen.finalSettings.matchResult) !== JSON.stringify(frozen.result)) throw new Error("Frozen replay result does not match final snapshot");
}

function validateReplayAction(action: unknown): void {
	if (!isRecord(action)) throw new Error("Replay actions must be objects");
	if (action.type !== "shoot" && action.type !== "itemUse") {
		throw new Error(`Unknown replay action type '${String(action.type)}'`);
	}
	if (typeof action.actorId !== "string" || action.actorId.length === 0) {
		throw new Error("Replay actions require a non-empty actorId");
	}
	if (action.type === "shoot") {
		for (const key of Object.keys(action)) {
			if (!(SHOOT_ACTION_KEYS as readonly string[]).includes(key)) {
				throw new Error(`Unknown replay shoot action field '${key}'`);
			}
		}
		if (!isRecord(action.input)) throw new Error("Replay shoot actions require an input object");
		for (const key of Object.keys(action.input)) {
			if (!(SHOOT_INPUT_KEYS as readonly string[]).includes(key)) {
				throw new Error(`Unknown replay shoot input field '${key}'`);
			}
		}
		const { angle, power } = action.input as { angle?: unknown; power?: unknown };
		if (typeof angle !== "number" || !Number.isFinite(angle)) throw new Error("Replay shoot angle must be a finite number");
		if (typeof power !== "number" || !Number.isFinite(power)) throw new Error("Replay shoot power must be a finite number");
		return;
	}
	for (const key of Object.keys(action)) {
		if (!(ITEM_USE_ACTION_KEYS as readonly string[]).includes(key)) {
			throw new Error(`Unknown replay item use action field '${key}'`);
		}
	}
	if (typeof action.itemId !== "string" || action.itemId.length === 0) {
		throw new Error("Replay item use actions require a non-empty itemId");
	}
	if (!isRecord(action.target)) throw new Error("Replay item use actions require a target object");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
