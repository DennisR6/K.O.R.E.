import { DOCUMENT_SCHEMA_VERSION, migrateDocument } from "../contracts/documents.js";
import type { SaveSlotDocument } from "../contracts/documents.js";
import { validateGameSettings, type GameSettings } from "../settings/settings.js";

export type { SaveSlotDocument };
export { DOCUMENT_SCHEMA_VERSION, migrateDocument };

export function createSaveSlot(id: string, name: string, settings: GameSettings, snapshot: Record<string, unknown>): SaveSlotDocument {
	validateGameSettings(settings);
	return {
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		id,
		name,
		timestamp: Date.now(),
		settings: JSON.parse(JSON.stringify(settings)),
		snapshot: JSON.parse(JSON.stringify(snapshot)),
	};
}

export function validateSaveSlotDocument(document: unknown): asserts document is SaveSlotDocument {
	if (!isRecord(document) || document.schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
		throw new Error("Invalid save slot schema version");
	}
	if (typeof document.id !== "string" || typeof document.name !== "string" || typeof document.timestamp !== "number" || !Number.isFinite(document.timestamp)) {
		throw new Error("Invalid save slot metadata");
	}
	if (!isRecord(document.snapshot)) {
		throw new Error("Invalid save slot snapshot");
	}
	validateGameSettings((document as unknown as SaveSlotDocument).settings);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
