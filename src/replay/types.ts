import { DOCUMENT_SCHEMA_VERSION, migrateDocument } from "../contracts/documents.js";
import type { ReplayDocument, ReplayAction } from "../contracts/documents.js";

export type { ReplayDocument, ReplayAction };
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
