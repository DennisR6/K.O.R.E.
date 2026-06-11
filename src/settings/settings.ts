import type { UUID } from "crypto";
import { type AssetKey, AssetList } from "../assetManager/assets/assetRegistry.js";
import type { SHAPE, Vector2D } from "../physics/physics.js";
import IceMap from "./iceMap.js";
import { EffectTrigger, type FullEffectSettings, type IEffectable } from "../effects/types.js";
import { EffectPhysics } from "../effects/physics.js";
import { EffectMove } from "../effects/movement.js";

const MAPS = { IceMap }
MAPS;

export interface GameSettings {
	id: UUID
	screenResolution: SettingsScreenResolution;
	players: SettingsEntity[];
	mapBoundarys: MapBoundarySettings[];
	background: SettingsBackground;
	friction: FrictionSettings;
	effects: FullEffectSettings[];
	items: SettingsItem[];
	myTeam: number[],
	allTeams?: string[],
	allTeamSize: number,
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

export interface SettingsEntity extends IEffectable {
	id: UUID;
	position: Vector2D
	size: number;
	color?: string;
	team: number[];
	playericon: AssetList;
	hoop: AssetList;
}

export interface SettingsItem {
	id: UUID
	type: string
}

export interface FrictionSettings {
	friction: number;
	linearDrag: number;
	stopThreshold: number;
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

export type SettingsMap = { screenResolution: SettingsScreenResolution, mapBoundarys: MapBoundarySettings[], background: SettingsBackground }

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
const team1 = [
	{
		id: "300591aa-e47e-4708-8da8-e8feb9938555" as UUID,
		position: { x: 0, y: 0 },
		playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP,
		team: [0],
		size: playerSize,
		hoop: defaultHoop, effects: defaultEffects
	},
	{ id: "46d4ce14-0437-4a01-a99f-7bddff12e507" as UUID, position: { x: 0, y: 0 }, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: [0], size: playerSize, hoop: defaultHoop, effects: defaultEffects },
	{ id: "1a4f0fd9-4a26-4ac5-8332-c18b68f4f084" as UUID, position: { x: 0, y: 0 }, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: [0], size: playerSize, hoop: defaultHoop, effects: defaultEffects },
	{ id: "1ea70b24-bb63-4346-ad58-dcc85f2f3bbb" as UUID, position: { x: 0, y: 0 }, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: [0], size: playerSize, hoop: defaultHoop, effects: defaultEffects },
	{ id: "2663d694-7e93-4a1c-8fb8-9b905e3174a8" as UUID, position: { x: 0, y: 0 }, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: [0], size: playerSize, hoop: defaultHoop, effects: defaultEffects },
	{ id: "26a4b2f4-228f-449b-babf-ad935723bc73" as UUID, position: { x: 0, y: 0 }, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: [0], size: playerSize, hoop: defaultHoop, effects: defaultEffects },
]
const team2 = [
	{ id: "2ce98548-ab1e-482a-8130-fd270233cd97" as UUID, position: { x: 0, y: 0 }, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: [1, 1], size: playerSize, hoop: defaultHoop, effects: defaultEffects },
	{ id: "ff8e2c75-da89-4d54-b2fa-fbec418d0200" as UUID, position: { x: 0, y: 0 }, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: [1, 1], size: playerSize, hoop: defaultHoop, effects: defaultEffects },
	{ id: "f71b2986-d32a-46a0-8fb4-e8f95beb8de9" as UUID, position: { x: 0, y: 0 }, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: [1, 1], size: playerSize, hoop: defaultHoop, effects: defaultEffects },
	{ id: "f2c7eb70-aebd-4231-ba9d-4f5fa2d547cd" as UUID, position: { x: 0, y: 0 }, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: [1, 1], size: playerSize, hoop: defaultHoop, effects: defaultEffects },
	{ id: "58e7ac62-98fa-4552-87d0-49689a27a484" as UUID, position: { x: 0, y: 0 }, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: [1, 1], size: playerSize, hoop: defaultHoop, effects: defaultEffects },
	{ id: "3f66b025-978b-4de9-8032-996440744939" as UUID, position: { x: 0, y: 0 }, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: [1, 1], size: playerSize, hoop: defaultHoop, effects: defaultEffects }
]

IceMap.createPlayerStartPoints(0, team1)
IceMap.createPlayerStartPoints(1, team2)
export const GameSettings: GameSettings = {
	id: "8a67d1b0-5c76-4348-bc7a-012d8c9746cc",
	players: [
		/* Formation LINKS (3x2) */
		...team1,
		// /* Formation RECHTS (3x2) */
		...team2,
	],
	friction: FRICTION_TABLE.ice,
	items: [],
	effects: [],
	minPlayers: 2,
	maxPlayers: 2,
	allTeams: ["1bafa3d2-b0e3-4e66-8c4f-e8da14278123", "5935f4b2-b3bd-4792-a356-fdf74f20ca2e"],
	allTeamSize: 2,
	myTeam: [],
	...IceMap.IceMap,
}

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
