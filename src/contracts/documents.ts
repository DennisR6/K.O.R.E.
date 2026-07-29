import type { TurnPacket } from "../engine/types.js";
import type { GameSettings, SettingsItem, SettingsMap } from "../settings/settings.js";

export const DOCUMENT_SCHEMA_VERSION = 1;

export interface VersionedDocument {
	schemaVersion: number;
}

export type HazardDocument = VersionedDocument & { id: string; type: string };
export type AiDocument = VersionedDocument & { id: string; difficulty: string };
export type ReplayDocument = VersionedDocument & { initialSettings: GameSettings; turns: TurnPacket[] };
export type GameDocument = GameSettings;
export type MapDocument = SettingsMap;
export type ItemDocument = SettingsItem;

/** Adds the first explicit version to legacy documents and rejects unknown versions. */
export function migrateDocument<T extends object>(document: T): T & VersionedDocument {
	const version = (document as Partial<VersionedDocument>).schemaVersion
	if (version === undefined) return { ...document, schemaVersion: DOCUMENT_SCHEMA_VERSION }
	if (version !== DOCUMENT_SCHEMA_VERSION) throw new Error(`Unsupported document schema version: ${version}`)
	return { ...document, schemaVersion: version }
}
