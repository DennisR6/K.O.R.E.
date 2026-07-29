import type { TurnPacket } from "../engine/types.js";
import { SHAPE } from "../physics/physics.js";
import { arrangeInGrid, type GameSettings, type FrictionSettings, type MapBoundarySettings, type SettingsItem } from "../settings/settings.js";
import { createPlayerSettings } from "../entity/types.js";

export const DOCUMENT_SCHEMA_VERSION = 1;

export interface VersionedDocument {
	schemaVersion: number;
}

export interface HazardTrigger {
	type: "collision";
}
export type HazardDocument = VersionedDocument & { id: string; type: string; trigger: HazardTrigger; config: Record<string, unknown> };
export type AiDocument = VersionedDocument & { id: string; difficulty: string };
export type ReplayDocument = VersionedDocument & { initialSettings: GameSettings; turns: TurnPacket[] };
export type GameDocument = GameSettings;
export type ItemDocument = SettingsItem;

export interface MapMetadata {
	id: string;
	name: string;
	description?: string;
}

/** A rectangular region used to place one team's generated figures. */
export interface MapSpawnRegion {
	team: number;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Canonical data-only map document; loading it into engine settings is separate. */
export interface MapDocument extends VersionedDocument {
	metadata: MapMetadata;
	worldSize: { x: number; y: number };
	friction: FrictionSettings;
	drift: number;
	arenaGeometry: MapBoundarySettings[];
	spawnRegions: MapSpawnRegion[];
	hazards: HazardDocument[];
}

/** Adds the first explicit version to legacy documents and rejects unknown versions. */
export function migrateDocument<T extends object>(document: T): T & VersionedDocument {
	const version = (document as Partial<VersionedDocument>).schemaVersion
	if (version === undefined) return { ...document, schemaVersion: DOCUMENT_SCHEMA_VERSION }
	if (version !== DOCUMENT_SCHEMA_VERSION) throw new Error(`Unsupported document schema version: ${version}`)
	return { ...document, schemaVersion: version }
}

/** Validates canonical map data without assigning any hazard runtime semantics. */
export function validateMapDocument(document: unknown): asserts document is MapDocument {
	if (!isRecord(document) || document.schemaVersion !== DOCUMENT_SCHEMA_VERSION) throw new Error("Invalid map schema version")
	if (!isRecord(document.metadata) || typeof document.metadata.id !== "string" || typeof document.metadata.name !== "string") throw new Error("Invalid map metadata")
	if (!isVector(document.worldSize) || document.worldSize.x <= 0 || document.worldSize.y <= 0) throw new Error("Invalid map world size")
	if (!isFriction(document.friction) || typeof document.drift !== "number" || !Number.isFinite(document.drift) || document.drift < 0 || document.drift > 1) throw new Error("Invalid map physics")
	if (!Array.isArray(document.arenaGeometry) || !document.arenaGeometry.every(isArenaGeometry) || !Array.isArray(document.spawnRegions) || !Array.isArray(document.hazards)) throw new Error("Invalid map collections")
	if (!document.spawnRegions.every(isSpawnRegion)) throw new Error("Invalid map spawn region")
	if (!document.hazards.every(hazard => isRecord(hazard) && hazard.schemaVersion === DOCUMENT_SCHEMA_VERSION && typeof hazard.id === "string" && typeof hazard.type === "string" && isRecord(hazard.trigger) && hazard.trigger.type === "collision" && isRecord(hazard.config))) throw new Error("Invalid map hazard")
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null }
function isVector(value: unknown): value is { x: number; y: number } { return isRecord(value) && typeof value.x === "number" && typeof value.y === "number" && Number.isFinite(value.x) && Number.isFinite(value.y) }
function isFriction(value: unknown): value is FrictionSettings {
	return isRecord(value) && [value.friction, value.linearDrag, value.stopThreshold].every(item => typeof item === "number" && Number.isFinite(item))
}
function isSpawnRegion(value: unknown): value is MapSpawnRegion {
	return isRecord(value) && typeof value.team === "number" && Number.isSafeInteger(value.team) && value.team >= 0 && typeof value.w === "number" && typeof value.h === "number" && [value.x, value.y, value.w, value.h].every(item => typeof item === "number" && Number.isFinite(item)) && value.w > 0 && value.h > 0
}
function isArenaGeometry(value: unknown): value is MapBoundarySettings {
	if (!isRecord(value) || typeof value.x !== "number" || typeof value.y !== "number" || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Array.isArray(value.effects)) return false
	if (value.type === SHAPE.CIRCLE) return typeof value.r === "number" && value.r > 0
	if (value.type === SHAPE.RECTANGLE) return typeof value.w === "number" && typeof value.h === "number" && value.w > 0 && value.h > 0
	return value.type === SHAPE.LINE && typeof value.x2 === "number" && typeof value.y2 === "number" && Number.isFinite(value.x2) && Number.isFinite(value.y2)
}

/** Converts a validated hazard-free canonical map into playable game settings. */
export function loadMapDocument(map: MapDocument, template: GameSettings): GameSettings {
	validateMapDocument(map)
	if (map.hazards.length > 0) throw new Error("Cannot load map hazards before runtime adapters exist")
	const players = template.players.map(player => createPlayerSettings(player))
	const playersByTeam = new Map<number, typeof players>()
	for (const player of players) {
		const team = player.team[0]
		if (team === undefined) throw new Error("Map loading requires each player to have a team")
		const teamPlayers = playersByTeam.get(team) ?? []
		teamPlayers.push(player)
		playersByTeam.set(team, teamPlayers)
	}
	for (const [team, teamPlayers] of playersByTeam) {
		const region = map.spawnRegions.find(spawn => spawn.team === team)
		if (!region) throw new Error(`Map has no spawn region for team ${team}`)
		arrangeInGrid(teamPlayers, region)
	}
	return {
		...template,
		players,
		worldSize: { ...map.worldSize },
		friction: { ...map.friction },
		drift: map.drift,
		mapBoundarys: map.arenaGeometry.map(boundary => ({ ...boundary, effects: boundary.effects.map(effect => ({ ...effect })) })),
	}
}
