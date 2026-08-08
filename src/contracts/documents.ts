import type { TurnPacket } from "../engine/types.js";
import { SHAPE } from "../physics/physics.js";
import { arrangeInGrid, type GameSettings, type FrictionSettings, type MapBoundarySettings, type MapBoundarySettingsCircle, type MapBoundarySettingsRect } from "../settings/settings.js";
import { createPlayerSettings, type PlayerSettings } from "../entity/types.js";
import { validateEnvironmentalMechanics, type EnvironmentalMechanic } from "../environment/environmental.js";
import { deriveStructureId } from "../structures/identity.js";
import type { CounterEffectSettings } from "../engine/sdk/counterCapability.js";
import { createCollisionCommandBinding, type CollisionCommandBinding } from "../engine/sdk/collisionCommand.js";
import { createEngineEffectComposition } from "../engine/sdk/composition.js";
import { PARTICIPATION_SET_DRAWING_EFFECT_ID, PARTICIPATION_SET_PHYSICS_EFFECT_ID } from "../engine/sdk/participationCapability.js";
import { MOVEMENT_ADD_VELOCITY_EFFECT_ID } from "../engine/sdk/movementCapability.js";



export const DOCUMENT_SCHEMA_VERSION = 1;

export interface VersionedDocument {
	schemaVersion: number;
}

export interface HazardTrigger {
	type: "collision";
}
export type HazardDocument = VersionedDocument & { id: string; type: string; trigger: HazardTrigger; config: Record<string, unknown> };
export type AiDocument = VersionedDocument & { id: string; difficulty: string };
export type ReplayAction = { type: "shoot" | "itemUse"; actorId: string; input?: { angle: number; power: number }; itemId?: string; target?: unknown } | { type: "counter"; effect: CounterEffectSettings };
export type ReplayDocument = VersionedDocument & { initialSettings: GameSettings; seed: number; actions: ReplayAction[]; turns?: TurnPacket[] };
export type SaveSlotDocument = VersionedDocument & { id: string; name: string; timestamp: number; settings: GameSettings; snapshot: Record<string, unknown> };
export type GameSettingsExport = VersionedDocument & { exportedAt: number; settings: GameSettings };
export type GameDocument = GameSettings;

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
	environmentalMechanics?: EnvironmentalMechanic[];
}

/** Versioned export produced by the standalone map editor, not an engine map. */
export interface EditorMapDocument extends VersionedDocument {
	name: string;
	background: EditorBackground | null;
	screenResolution: EditorScreenResolution;
	mapBoundarys: EditorWall[];
	holes: EditorHole[];
	players: EditorPlayer[];
	friction: FrictionSettings;
	drift: number;
	items: EditorItem[];
	effects: EditorHazard[];
	mode: EditorMode;
	ai: EditorAi;
}

export interface EditorBackground { type: "image"; url: string }
export interface EditorScreenResolution { x: number; y: number; factor: number }
export interface EditorWall { type: "rectangle"; x: number; y: number; w: number; h: number; color: string }
export interface EditorHole { type: "circle"; x: number; y: number; r: number; color: string }
export interface EditorPlayer { x: number; y: number; color: string; team: number }
export interface EditorItem {
	id: string;
	name: string;
	effectType: string;
	trigger: string;
	frequency: EditorItemFrequency;
	probability: number;
	spawn: EditorItemSpawn;
	effectParams?: Record<string, number>;
}
export interface EditorItemFrequency {
	mode: string;
	intervalRounds: number;
	killsInterval: number;
	lastPlayersThreshold: number;
	healthThreshold: number;
	boostFactor: number;
}
export interface EditorItemSpawn { type: "points"; points: EditorPoint[]; areas: EditorSpawnArea[] }
export interface EditorPoint { x: number; y: number }
export type EditorSpawnArea = EditorCircleSpawnArea | EditorRectangleSpawnArea;
export interface EditorCircleSpawnArea { shape: "circle"; x: number; y: number; radius: number; width: number; height: number }
export interface EditorRectangleSpawnArea { shape: "rect"; x: number; y: number; radius: number; width: number; height: number }
export type EditorHazard = EditorPushHazard | EditorSlideHazard | EditorStickyHazard | EditorKillHazard;
export interface EditorHazardBase { id: string; position: EditorPoint; size: { w: number; h: number } }
export interface EditorPushHazard extends EditorHazardBase { type: "push_zone"; params: { direction: number; force: number } }
export interface EditorSlideHazard extends EditorHazardBase { type: "slide_zone"; params: { slideFactor: number } }
export interface EditorStickyHazard extends EditorHazardBase { type: "sticky_zone"; params: { stickFactor: number } }
export interface EditorKillHazard extends EditorHazardBase { type: "kill_zone"; params: { killOnTouch: boolean } }
export type EditorMode = EditorLastManStandingMode | EditorKnockoutRaceMode;
export interface EditorLastManStandingMode { type: "last_man_standing"; params: { itemsEnabled: boolean; hazardsEnabled: boolean; allowTies: boolean } }
export interface EditorKnockoutRaceMode { type: "knockout_race"; params: { pointsToWin: number; respawn: boolean; respawnDelay: number; maxRespawnsPerRound: number; itemsEnabled: boolean; hazardsEnabled: boolean } }
export interface EditorAi { difficulty: "easy" | "normal" | "hard" | "insane" | "custom"; aggressiveness: number; riskTaking: number; itemPriority: number; hazardAwareness: number; errorRate: number }

/** Adds the first explicit version to legacy documents and rejects unknown versions. */
export function migrateDocument<T extends object>(document: T): T & VersionedDocument {
	if (!document || typeof document !== "object" || Array.isArray(document)) {
		throw new Error("Document must be an object");
	}
	const version = (document as Partial<VersionedDocument>).schemaVersion
	if (version === undefined) return { ...document, schemaVersion: DOCUMENT_SCHEMA_VERSION }
	if (version !== DOCUMENT_SCHEMA_VERSION) throw new Error(`Unsupported document schema version: ${version}`)
	return { ...document, schemaVersion: version }
}

/** Validates canonical map data and the collision hazards supported by the map loader. */
export function validateMapDocument(document: unknown): asserts document is MapDocument {
	if (!isRecord(document) || document.schemaVersion !== DOCUMENT_SCHEMA_VERSION) throw new Error("Invalid map schema version")
	if (!isRecord(document.metadata) || typeof document.metadata.id !== "string" || typeof document.metadata.name !== "string") throw new Error("Invalid map metadata")
	if (!isVector(document.worldSize) || document.worldSize.x <= 0 || document.worldSize.y <= 0) throw new Error("Invalid map world size")
	if (!isFriction(document.friction) || typeof document.drift !== "number" || !Number.isFinite(document.drift) || document.drift < 0 || document.drift > 1) throw new Error("Invalid map physics")
	if (!Array.isArray(document.arenaGeometry) || !document.arenaGeometry.every(isArenaGeometry) || !Array.isArray(document.spawnRegions) || !Array.isArray(document.hazards)) throw new Error("Invalid map collections")
	if (!document.spawnRegions.every(isSpawnRegion)) throw new Error("Invalid map spawn region")
	if (!document.hazards.every(isMapHazard)) throw new Error("Invalid map hazard")
	if (document.environmentalMechanics !== undefined) validateEnvironmentalMechanics(document.environmentalMechanics)
}

/** Validates the standalone editor's versioned export without treating it as GameSettings. */
export function validateEditorMapDocument(document: unknown): asserts document is EditorMapDocument {
	if (!isRecord(document) || document.schemaVersion !== DOCUMENT_SCHEMA_VERSION || typeof document.name !== "string" || !isEditorBackground(document.background) || !isEditorScreenResolution(document.screenResolution)) throw new Error("Invalid editor map document")
	if (!isFriction(document.friction) || !isNonNegativeFinite(document.drift) || document.drift > 1) throw new Error("Invalid editor map physics")
	if (!Array.isArray(document.mapBoundarys) || !Array.isArray(document.holes) || !Array.isArray(document.players) || !Array.isArray(document.items) || !Array.isArray(document.effects)) throw new Error("Invalid editor map collections")
	if (!document.mapBoundarys.every(isEditorWall) || !document.holes.every(isEditorHole) || !document.players.every(isEditorPlayer)) throw new Error("Invalid editor map geometry")
	if (!document.items.every(isEditorItem) || !hasUniqueIds(document.items) || !document.effects.every(isEditorHazard) || !hasUniqueIds(document.effects)) throw new Error("Invalid editor map collection entry")
	if (!isEditorMode(document.mode) || !isEditorAi(document.ai)) throw new Error("Invalid editor map configuration")
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null }
function isVector(value: unknown): value is { x: number; y: number } { return isRecord(value) && typeof value.x === "number" && typeof value.y === "number" && Number.isFinite(value.x) && Number.isFinite(value.y) }
function isNonNegativeFinite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0 }
function isPositiveFinite(value: unknown): value is number { return isNonNegativeFinite(value) && value > 0 }
function isSafeUrl(url: string): boolean {
	const lower = url.trim().toLowerCase()
	return !lower.startsWith("javascript:") && !lower.startsWith("vbscript:") && !lower.startsWith("data:text/html")
}
function isEditorBackground(value: unknown): value is EditorBackground | null { return value === null || (isRecord(value) && value.type === "image" && typeof value.url === "string" && isSafeUrl(value.url)) }
function isEditorScreenResolution(value: unknown): value is EditorScreenResolution { return isRecord(value) && isPositiveFinite(value.x) && isPositiveFinite(value.y) && isPositiveFinite(value.factor) }
function hasFiniteVector(value: Record<string, unknown>): boolean { return typeof value.x === "number" && Number.isFinite(value.x) && typeof value.y === "number" && Number.isFinite(value.y) }
function isEditorWall(value: unknown): value is EditorWall { return isRecord(value) && value.type === "rectangle" && hasFiniteVector(value) && isPositiveFinite(value.w) && isPositiveFinite(value.h) && typeof value.color === "string" }
function isEditorHole(value: unknown): value is EditorHole { return isRecord(value) && value.type === "circle" && hasFiniteVector(value) && isPositiveFinite(value.r) && typeof value.color === "string" }
function isEditorPlayer(value: unknown): value is EditorPlayer { return isRecord(value) && hasFiniteVector(value) && typeof value.color === "string" && typeof value.team === "number" && Number.isSafeInteger(value.team) && value.team >= 0 }
function isEditorItem(value: unknown): value is EditorItem {
	return isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.effectType === "string" && typeof value.trigger === "string" && isEditorItemFrequency(value.frequency) && isNonNegativeFinite(value.probability) && value.probability <= 100 && isEditorItemSpawn(value.spawn) && (value.effectParams === undefined || isNumericRecord(value.effectParams))
}
function isEditorItemFrequency(value: unknown): value is EditorItemFrequency {
	return isRecord(value) && typeof value.mode === "string" && [value.intervalRounds, value.killsInterval, value.lastPlayersThreshold, value.healthThreshold, value.boostFactor].every(isNonNegativeFinite)
}
function isEditorItemSpawn(value: unknown): value is EditorItemSpawn { return isRecord(value) && value.type === "points" && Array.isArray(value.points) && value.points.every(isVector) && Array.isArray(value.areas) && value.areas.every(isEditorSpawnArea) }
function isEditorSpawnArea(value: unknown): value is EditorSpawnArea { return isRecord(value) && (value.shape === "circle" || value.shape === "rect") && hasFiniteVector(value) && isPositiveFinite(value.radius) && isPositiveFinite(value.width) && isPositiveFinite(value.height) }
function isEditorHazard(value: unknown): value is EditorHazard {
	if (!isRecord(value) || typeof value.id !== "string" || !isVector(value.position) || !isRecord(value.size) || !isPositiveFinite(value.size.w) || !isPositiveFinite(value.size.h) || !isRecord(value.params)) return false
	if (value.type === "push_zone") return isNonNegativeFinite(value.params.direction) && value.params.direction <= 360 && isNonNegativeFinite(value.params.force) && value.params.force <= 5
	if (value.type === "slide_zone") return isNonNegativeFinite(value.params.slideFactor) && value.params.slideFactor <= 2
	if (value.type === "sticky_zone") return isNonNegativeFinite(value.params.stickFactor) && value.params.stickFactor <= 1
	return value.type === "kill_zone" && typeof value.params.killOnTouch === "boolean"
}
function isEditorMode(value: unknown): value is EditorMode {
	if (!isRecord(value) || !isRecord(value.params)) return false
	if (value.type === "last_man_standing") return [value.params.itemsEnabled, value.params.hazardsEnabled, value.params.allowTies].every(item => typeof item === "boolean")
	return value.type === "knockout_race" && isPositiveInteger(value.params.pointsToWin) && typeof value.params.respawn === "boolean" && isPositiveInteger(value.params.respawnDelay) && isPositiveInteger(value.params.maxRespawnsPerRound) && typeof value.params.itemsEnabled === "boolean" && typeof value.params.hazardsEnabled === "boolean"
}
function isEditorAi(value: unknown): value is EditorAi { return isRecord(value) && (value.difficulty === "easy" || value.difficulty === "normal" || value.difficulty === "hard" || value.difficulty === "insane" || value.difficulty === "custom") && [value.aggressiveness, value.riskTaking, value.itemPriority, value.hazardAwareness, value.errorRate].every(item => isNonNegativeFinite(item) && item <= 100) }
function isNumericRecord(value: unknown): value is Record<string, number> { return isRecord(value) && Object.values(value).every(Number.isFinite) }
function isPositiveInteger(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0 }
function hasUniqueIds(values: { id: string }[]): boolean { return new Set(values.map(value => value.id)).size === values.length }
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

/** Arranges a full six-figure team as a centered 2x3 formation; smaller teams use the compact grid. */
function arrangeTeamStartGrid(players: PlayerSettings[], region: MapSpawnRegion): void {
	if (players.length === 6) {
		const size = players[0]!.size * 2;
		const cellSize = Math.min(region.w / 2, region.h / 3);
		if (!(cellSize > size)) throw new Error("Map spawn region is too small for the 2x3 team formation");
		const offsetX = (region.w - cellSize * 2) / 2;
		// Top-aligned like arrangeInGrid: several map documents define regions
		// that extend past the world height, so vertical centering would push
		// the last row outside containment.
		const offsetY = 0;
		players.forEach((player, index) => {
			const col = index % 2;
			const row = Math.floor(index / 2);
			player.position.x = region.x + offsetX + col * cellSize + size / 2;
			player.position.y = region.y + offsetY + row * cellSize + size / 2;
		});
		return;
	}
	arrangeInGrid(players, region);
}

/** Converts validated map geometry and supported collision hazards into playable game settings. */
export function loadMapDocument(map: MapDocument, template: GameSettings): GameSettings {
	validateMapDocument(map)
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
		arrangeTeamStartGrid(teamPlayers, region)
	}
	return {
		...template,
		players,
		worldSize: { ...map.worldSize },
		friction: { ...map.friction },
		drift: map.drift,
		mapBoundarys: assignStableStructureIds([
			...map.arenaGeometry.map(boundary => ({
				...boundary,
				// Uncolored solid geometry must stay render-visible in the
				// production browser selection path (17.8); the invisible
				// containment boundary keeps the engine template convention.
				color: boundary.color ?? (boundary.role === "containment" ? undefined : DEFAULT_MAP_STRUCTURE_COLOR),
				effects: boundary.effects.map(effect => ({ ...effect })),
			})),
			...map.hazards.map(hazardToBoundary),
			...(map.environmentalMechanics ?? []).map(environmentalMechanicToBoundary),
		]),
		environmentalMechanics: map.environmentalMechanics ? structuredClone(map.environmentalMechanics) : undefined,
	}
}

/** Default render color for uncolored solid map geometry. */
export const DEFAULT_MAP_STRUCTURE_COLOR = "#315b7d";

/** Converts a validated standalone editor export into engine settings without merging their data models. */
export function convertEditorMapDocument(editorMap: unknown, template: GameSettings): GameSettings {
	validateEditorMapDocument(editorMap)
	if (editorMap.items.length > 0) throw new Error("Editor map items are not supported")
	if (!isDefaultEditorMode(editorMap.mode)) throw new Error("Only the default last_man_standing mode is supported")
	if (!isDefaultEditorAi(editorMap.ai)) throw new Error("Only the default editor AI configuration is supported")
	if (editorMap.effects.some(hazard => hazard.type === "slide_zone" || hazard.type === "sticky_zone")) throw new Error("Unsupported editor hazard type")

	const worldSize = { x: editorMap.screenResolution.x, y: editorMap.screenResolution.y }
	const spawnRegions = editorSpawnRegions(editorMap.players)
	const arenaGeometry: MapBoundarySettings[] = [
		...editorMap.mapBoundarys.map<MapBoundarySettingsRect>(wall => ({ type: SHAPE.RECTANGLE, x: wall.x, y: wall.y, w: wall.w, h: wall.h, color: wall.color, effects: [] })),
		...editorMap.holes.map<MapBoundarySettingsCircle>(hole => ({ type: SHAPE.CIRCLE, x: hole.x, y: hole.y, r: hole.r, color: hole.color, effects: [] })),
	]
	const canonicalMap: MapDocument = {
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		metadata: { id: editorMap.name || "editor-map", name: editorMap.name },
		worldSize,
		friction: { ...editorMap.friction },
		drift: editorMap.drift,
		arenaGeometry,
		spawnRegions,
		hazards: [],
	}
	const settings = loadMapDocument(canonicalMap, template)
	return {
		...settings,
		screenResolution: { ...worldSize },
		mapBoundarys: assignStableStructureIds([...settings.mapBoundarys, ...editorMap.effects.map(editorHazardToBoundary)]),
	}
}

/** Adds deterministic IDs to legacy map geometry without using runtime indexes. */
function assignStableStructureIds(boundaries: MapBoundarySettings[]): MapBoundarySettings[] {
	return boundaries.map(boundary => ({ ...boundary, id: boundary.id ?? deriveStructureId(boundary) }));
}

const EDITOR_SPAWN_PADDING = 20;

function editorSpawnRegions(players: EditorPlayer[]): MapSpawnRegion[] {
	const pointsByTeam = new Map<number, EditorPlayer[]>()
	for (const player of players) {
		const points = pointsByTeam.get(player.team) ?? []
		points.push(player)
		pointsByTeam.set(player.team, points)
	}
	return [...pointsByTeam.entries()].map(([team, points]) => {
		const xs = points.map(point => point.x)
		const ys = points.map(point => point.y)
		const minX = Math.min(...xs)
		const maxX = Math.max(...xs)
		const minY = Math.min(...ys)
		const maxY = Math.max(...ys)
		return {
			team,
			x: minX - EDITOR_SPAWN_PADDING,
			y: minY - EDITOR_SPAWN_PADDING,
			w: maxX - minX + EDITOR_SPAWN_PADDING * 2,
			h: maxY - minY + EDITOR_SPAWN_PADDING * 2,
		}
	})
}

function isDefaultEditorMode(mode: EditorMode): boolean {
	return mode.type === "last_man_standing" && mode.params.itemsEnabled === true && mode.params.hazardsEnabled === false && mode.params.allowTies === false
}

function isDefaultEditorAi(ai: EditorAi): boolean {
	return ai.difficulty === "normal" && ai.aggressiveness === 50 && ai.riskTaking === 40 && ai.itemPriority === 50 && ai.hazardAwareness === 60 && ai.errorRate === 20
}

function editorHazardToBoundary(hazard: EditorHazard): MapBoundarySettingsRect {
	const lethal = hazard.type === "kill_zone" ? [lethalCollisionCommand()] : undefined;
	return {
		type: SHAPE.RECTANGLE,
		x: hazard.position.x,
		y: hazard.position.y,
		w: hazard.size.w,
		h: hazard.size.h,
		color: hazard.type === "kill_zone" ? "#d94b28" : "#f0a020",
		effects: [],
		...(hazard.type === "push_zone" ? { collisionCommands: [pushZoneCommand(hazard)] } : lethal ? { collisionCommands: lethal } : {}),
	}
}

function pushZoneCommand(hazard: EditorPushHazard): CollisionCommandBinding {
	const radians = (hazard.params.direction * Math.PI) / 180
	return createCollisionCommandBinding({ schemaVersion: 1, type: MOVEMENT_ADD_VELOCITY_EFFECT_ID, typeValue: { x: Math.cos(radians) * hazard.params.force, y: Math.sin(radians) * hazard.params.force } });
}

type HazardZone = { x: number; y: number; r: number };
type ForceHazardConfig = HazardZone & { angle: number; power: number };

function isMapHazard(value: unknown): value is HazardDocument {
	if (!isRecord(value) || value.schemaVersion !== DOCUMENT_SCHEMA_VERSION || typeof value.id !== "string" || !value.id || typeof value.type !== "string" || !isRecord(value.trigger) || value.trigger.type !== "collision" || !isRecord(value.config)) return false
	if (!isHazardZone(value.config)) return false
	if (value.type === "kill-zone") return true
	return value.type === "force" && typeof value.config.angle === "number" && Number.isFinite(value.config.angle) && value.config.angle >= 0 && value.config.angle < 360 && typeof value.config.power === "number" && Number.isFinite(value.config.power) && value.config.power > 0
}

function isHazardZone(value: Record<string, unknown>): value is Record<string, unknown> & HazardZone {
	const { x, y, r } = value;
	return [x, y, r].every(item => typeof item === "number" && Number.isFinite(item)) && typeof r === "number" && r > 0
}

function hazardToBoundary(hazard: HazardDocument): MapBoundarySettings {
	const zone = hazard.config as HazardZone;
	return {
		type: SHAPE.CIRCLE,
		x: zone.x,
		y: zone.y,
		r: zone.r,
		color: hazard.type === "kill-zone" ? "#d94b28" : "#f0a020",
		effects: [],
		...(hazard.type === "kill-zone" ? { collisionCommands: [lethalCollisionCommand()] } : { collisionCommands: [forceHazardCommand(hazard)] }),
	};
}

function lethalCollisionCommand(): CollisionCommandBinding {
	return createCollisionCommandBinding(createEngineEffectComposition([
		{ schemaVersion: 1, type: PARTICIPATION_SET_PHYSICS_EFFECT_ID, typeValue: { enabled: false } },
		{ schemaVersion: 1, type: PARTICIPATION_SET_DRAWING_EFFECT_ID, typeValue: { enabled: false } },
	]));
}

function forceHazardCommand(hazard: HazardDocument): CollisionCommandBinding {
	const config = hazard.config as ForceHazardConfig;
	const radians = (config.angle * Math.PI) / 180;
	return createCollisionCommandBinding({ schemaVersion: 1, type: MOVEMENT_ADD_VELOCITY_EFFECT_ID, typeValue: { x: Math.cos(radians) * config.power, y: Math.sin(radians) * config.power } });
}

function environmentalMechanicToBoundary(mechanic: EnvironmentalMechanic): MapBoundarySettings {
	return { ...structuredClone(mechanic.structure), effects: structuredClone(mechanic.effects ?? mechanic.structure.effects) }
}
