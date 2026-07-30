import type { UUID } from "crypto";
import { type AssetKey, AssetList } from "../assetManager/assets/assetRegistry.js";
import { SHAPE, type Vector2D } from "../physics/physics.js";
import { createPlayerSettings, type PlayerSettings } from "../entity/types.js";
import IceMap from "./iceMap.js";
import { EffectTrigger, EffectType, type FullEffectSettings, type IEffectable } from "../effects/types.js";
import { EffectPhysics } from "../effects/physics.js";
import { EffectMove } from "../effects/movement.js";
import { currentTurnMode } from "../rules/defaultGameModes.js";
import { validateItemEconomySettings, type GameModeSettings } from "../rules/types.js";

const MAPS = { IceMap }
MAPS;

export interface GameSettings {
	schemaVersion: number;
	id: UUID
	screenResolution: SettingsScreenResolution;
	worldSize: SettingsScreenResolution;
	players: PlayerSettings[];
	mapBoundarys: MapBoundarySettings[];
	background: SettingsBackground;
	friction: FrictionSettings;
	drift: number;
	effects: FullEffectSettings[];
	items: SettingsItem[];
	myTeam: number[],
	allTeams?: string[],
	allTeamSize: number,
	playerCount: number,
	figuresPerPlayer: number,
	/** Optional to keep persisted settings from before game modes loadable. */
	gameMode?: GameModeSettings,
	minPlayers: number,
	maxPlayers: number,
	turn?: number
}

export interface SettingsScreenResolution {
	x: number,
	y: number,
}

export type SettingsBackground = SettingsBackgroundColor | SettingsBackgroundImage

export interface SettingsBackgroundImage {
	type: "image"
	url: AssetKey
}
export interface SettingsBackgroundColor {
	type: "color"
	color: string
}




export type MapBoundarySettings = MapBoundarySettingsCircle | MapBoundarySettingsLine | MapBoundarySettingsRect
export interface IMapBoundarySettings extends IEffectable {
	type: SHAPE
	x: number;
	y: number;
}
export interface MapBoundarySettingsCircle extends IMapBoundarySettings {
	type: SHAPE.CIRCLE
	r: number;
	color?: string;
}

export interface MapBoundarySettingsLine extends IMapBoundarySettings {
	type: SHAPE.LINE
	x2: number;
	y2: number;
	color?: string;
}

export interface MapBoundarySettingsRect extends IMapBoundarySettings {
	type: SHAPE.RECTANGLE
	w: number;
	h: number;
	color?: string;
}

export interface SettingsItem {
	schemaVersion: number
	id: UUID
	type: string
}

export interface FrictionSettings {
	friction: number;
	linearDrag: number;
	stopThreshold: number;
}

export const DEFAULT_DRIFT = 0;

/** Ensures map drift is a per-tick direction blend. */
export function validateDrift(drift: number): void {
	if (!Number.isFinite(drift) || drift < 0 || drift > 1) throw new Error("Map drift must be a finite number between 0 and 1");
}

/** Ensures match layout settings describe at least one whole player and figure. */
export function validateFigureCounts(playerCount: number, figuresPerPlayer: number): void {
	if (!Number.isSafeInteger(playerCount) || playerCount < 1 || !Number.isSafeInteger(figuresPerPlayer) || figuresPerPlayer < 1) {
		throw new Error("Player count and figures per player must be positive integers");
	}
}

/** Rejects malformed external game settings before they enter the runtime. */
export function validateGameSettings(settings: unknown): asserts settings is GameSettings {
	if (!isRecord(settings) || settings.schemaVersion !== 1 || typeof settings.id !== "string") throw new Error("Invalid game settings document")
	if (!isVector(settings.screenResolution) || settings.screenResolution.x <= 0 || settings.screenResolution.y <= 0) throw new Error("Invalid screen resolution")
	if (!isRecord(settings.friction) || ![settings.friction.friction, settings.friction.linearDrag, settings.friction.stopThreshold].every(Number.isFinite)) throw new Error("Invalid friction settings")
	validateDrift(settings.drift)
	validateFigureCounts(settings.playerCount, settings.figuresPerPlayer)
	if (!Array.isArray(settings.myTeam) || !settings.myTeam.every(isTeam)) throw new Error("Invalid team settings")
	if (!Array.isArray(settings.players) || !settings.players.every(player => isRecord(player) && isVector(player.position) && isVector(player.velocity) && Array.isArray(player.team) && player.team.every(isTeam) && Array.isArray(player.effects) && player.effects.every(isEffect))) throw new Error("Invalid player settings")
	if (!Array.isArray(settings.mapBoundarys) || !settings.mapBoundarys.every(isBoundary)) throw new Error("Invalid map boundary settings")
	if (!Array.isArray(settings.effects) || !settings.effects.every(isEffect)) throw new Error("Invalid effect settings")
	if (!Array.isArray(settings.items) || !settings.items.every(item => isRecord(item) && item.schemaVersion === 1 && typeof item.id === "string" && typeof item.type === "string")) throw new Error("Invalid item settings")
	if (settings.gameMode !== undefined) validateItemEconomySettings(settings.gameMode.itemEconomy)
}

function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null }
function isVector(value: unknown): value is Vector2D { return isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y) }
function isTeam(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 }
function isEffect(value: unknown): value is FullEffectSettings {
	const types = [EffectType.Physics, EffectType.Damage, EffectType.Movement, EffectType.Multi, EffectType.ModifyMass, EffectType.ModifySize, EffectType.Position, EffectType.Velocity, EffectType.Team, EffectType.ModifySetting]
	const triggers = [EffectTrigger.Always, EffectTrigger.Collision, EffectTrigger.Round]
	return isRecord(value) && types.includes(value.type) && triggers.includes(value.trigger)
}
function isBoundary(value: unknown): value is MapBoundarySettings {
	if (!isRecord(value) || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Array.isArray(value.effects) || !value.effects.every(isEffect)) return false
	if (value.type === SHAPE.CIRCLE) return Number.isFinite(value.r) && value.r > 0
	if (value.type === SHAPE.RECTANGLE) return Number.isFinite(value.w) && Number.isFinite(value.h) && value.w > 0 && value.h > 0
	return value.type === SHAPE.LINE && Number.isFinite(value.x2) && Number.isFinite(value.y2)
}

export const FRICTION_TABLE = {
	ice: { friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 },
	tiles: { friction: 0.98, linearDrag: 0.05, stopThreshold: 0.15 },
	wood: { friction: 0.96, linearDrag: 0.1, stopThreshold: 0.2 },
	billiards: { friction: 0.94, linearDrag: 0.15, stopThreshold: 0.2 },
	carpet_office: { friction: 0.91, linearDrag: 0.25, stopThreshold: 0.3 },
	gym: { friction: 0.88, linearDrag: 0.4, stopThreshold: 0.4 },
	turf: { friction: 0.82, linearDrag: 0.8, stopThreshold: 0.5 },
	asphalt: { friction: 0.75, linearDrag: 1.2, stopThreshold: 0.6 },
	grass: { friction: 0.6, linearDrag: 2.5, stopThreshold: 1.0 },
	sand: { friction: 0.4, linearDrag: 5.0, stopThreshold: 2.0 }
} as const

export type SettingsMap = { schemaVersion: number, screenResolution: SettingsScreenResolution, worldSize: SettingsScreenResolution, mapBoundarys: MapBoundarySettings[], background: SettingsBackground, drift: number }

const playerSize = 14
const defaultHoop = AssetList.pictureReifenWEBP
const defaultEffects: FullEffectSettings[] = [
	{
		trigger: EffectTrigger.Always, triggerValue: [],
		...new EffectMove({ typeValue: { deltaTime: 0, x: 0, y: 0 } }).toSettings(),
	},
	{
		trigger: EffectTrigger.Always, triggerValue: [],
		...new EffectPhysics({ typeValue: { ...FRICTION_TABLE.ice } }).toSettings()
	},
]
/** Builds the default two-sided ice-map layout from match figure settings. */
export function createDefaultPlayers(playerCount: number, figuresPerPlayer: number): PlayerSettings[] {
	validateFigureCounts(playerCount, figuresPerPlayer)
	if (playerCount > 2) throw new Error("The ice map supports at most two players")
	const icons = [AssetList.picturePenguinPenguinIdleFrame1WEBP, AssetList.picturePolarBearPolarBearIdleFrame1WEBP]
	return Array.from({ length: playerCount }, (_, team) => {
		const players = Array.from({ length: figuresPerPlayer }, () => createPlayerSettings({
			position: { x: 0, y: 0 },
			playericon: icons[team],
			team: [team],
			size: playerSize,
			hoop: defaultHoop,
			effects: defaultEffects,
		}))
		IceMap.createPlayerStartPoints(team, players)
		return players
	}).flat()
}

/** Builds complete default game settings with a generated ice-map team layout. */
export function createDefaultGameSettings(playerCount: number = 2, figuresPerPlayer: number = 6): GameSettings {
	return {
		id: "8a67d1b0-5c76-4348-bc7a-012d8c9746cc",
		players: createDefaultPlayers(playerCount, figuresPerPlayer),
		friction: FRICTION_TABLE.ice,
		items: [],
		effects: [],
		minPlayers: 2,
		maxPlayers: 2,
		allTeams: ["1bafa3d2-b0e3-4e66-8c4f-e8da14278123", "5935f4b2-b3bd-4792-a356-fdf74f20ca2e"],
		allTeamSize: 2,
		playerCount,
		figuresPerPlayer,
		gameMode: currentTurnMode,
		myTeam: [],
		...IceMap.IceMap,
	}
}

export const GameSettings = createDefaultGameSettings()

export function arrangeInGrid(
	players: { position: Vector2D, size: number }[],
	rect: { x: number, y: number, w: number, h: number },
	padding: number = 0
) {
	if (players.length === 0) return;

	const size = players[0].size * 2;
	const cellSize = size + padding + 1;

	const cols = Math.max(1, Math.floor(rect.w / cellSize));
	const rows = Math.max(1, Math.floor(rect.h / cellSize));

	if (cols * rows < players.length) throw new Error("Nicht genug Platz für alle Spieler!");

	players.forEach((player, index) => {
		const col = index % cols;
		const row = Math.floor(index / cols);

		player.position.x = rect.x + (col * cellSize) + (size / 2)
		player.position.y = rect.y + (row * cellSize) + (size / 2)
	})
}
