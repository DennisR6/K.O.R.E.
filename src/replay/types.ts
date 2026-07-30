import { DOCUMENT_SCHEMA_VERSION, migrateDocument } from "../contracts/documents.js";
import type { ReplayDocument, ReplayAction } from "../contracts/documents.js";

export type { ReplayDocument, ReplayAction };
export { DOCUMENT_SCHEMA_VERSION, migrateDocument };

export function validateReplayDocument(document: unknown): asserts document is ReplayDocument {
	if (!isRecord(document) || document.schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
		throw new Error("Invalid replay schema version");
	}
	if (!isRecord(document.initialSettings) || typeof document.seed !== "number" || !Number.isFinite(document.seed) || !Array.isArray(document.actions)) {
		throw new Error("Invalid replay document structure");
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
