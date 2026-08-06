import { DOCUMENT_SCHEMA_VERSION, migrateDocument } from "../contracts/documents.js";
import type { GameSettingsExport } from "../contracts/documents.js";
import { validateGameSettings, type GameSettings } from "../settings/settings.js";

export type { GameSettingsExport };
export { DOCUMENT_SCHEMA_VERSION, migrateDocument };

export function exportGameSettings(settings: GameSettings): GameSettingsExport {
	validateGameSettings(settings);
	return {
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		exportedAt: Date.now(),
		settings: JSON.parse(JSON.stringify(settings)),
	};
}

export function importGameSettings(data: unknown): GameSettings {
	if (!isRecord(data) || data.schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
		throw new Error("Invalid export schema version");
	}
	if (typeof data.exportedAt !== "number" || !Number.isFinite(data.exportedAt)) {
		throw new Error("Invalid export timestamp");
	}
	const settings = (data as unknown as GameSettingsExport).settings;
	validateGameSettings(settings);
	return JSON.parse(JSON.stringify(settings));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
