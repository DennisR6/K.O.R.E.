import type { UUID } from "node:crypto";
import { type AssetKey, AssetList } from "../assetManager/assets/assetRegistry.js";
import type { SHAPE } from "../physics/physics.js";
import { BilliardMap } from "./billiardMap.js"
import { IceMap } from "./iceMap.js";
import { EffectTrigger, EffectType } from "../effects/types.js";

const MAPS = { BilliardMap, IceMap }
MAPS;

export interface GameSettings {
	id: UUID
	screenResolution: SettingsScreenResolution;
	players: SettingsEntity[];
	team: string[],
	allTeam: string[],
	mapBoundarys: MapBoundarySettings<EffectType, EffectTrigger>[];
	background: SettingsBackground;
	friction: FrictionSettings;
	effects: SettingsEffect<EffectType, EffectTrigger>[];
	items: SettingsItem[];
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

export interface SettingsEffect<T extends EffectType, K extends EffectTrigger> {
	type: T,
	trigger: K,
	values: SettingsEffectTypeValues[T];
	triggerValues: SettingsEffectTriggerValues[K],
}
export interface SettingsEffectTriggerValues {
	[EffectTrigger.Collision]: {},
	[EffectTrigger.RoundBased]: {},
}
type SettingsEffectTypeValues = {
	[EffectType.Damage]: { damage: number },
	[EffectType.Physics]: {},
	[EffectType.None]: {},
}

export type MapBoundarySettings<T extends EffectType, K extends EffectTrigger> = MapBoundarySettingsCircle<T, K> | MapBoundarySettingsLine<T, K> | MapBoundarySettingsRect<T, K>
export interface IMapBoundarySettings<T extends EffectType, K extends EffectTrigger> {
	type: SHAPE
	x: number;
	y: number;
	effects: SettingsEffect<T, K>[]
}
export interface MapBoundarySettingsCircle<T extends EffectType, K extends EffectTrigger> extends IMapBoundarySettings<T, K> {
	type: SHAPE.CIRCLE
	r: number;
	color?: string;
}

export interface MapBoundarySettingsLine<T extends EffectType, K extends EffectTrigger> extends IMapBoundarySettings<T, K> {
	type: SHAPE.LINE
	x2: number;
	y2: number;
	color?: string;
}

export interface MapBoundarySettingsRect<T extends EffectType, K extends EffectTrigger> extends IMapBoundarySettings<T, K> {
	type: SHAPE.RECTANGLE
	w: number;
	h: number;
	color?: string;
}

export interface SettingsEntity {
	id: UUID;
	x: number;
	y: number;
	size?: number;
	color?: string;
	team: string[];
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
	ice: {
		friction: 0.995,
		linearDrag: 0.01,
		stopThreshold: 0.1,
	},
	tiles: {
		friction: 0.98,
		linearDrag: 0.05,
		stopThreshold: 0.15,
	},
	wood: {
		friction: 0.96,
		linearDrag: 0.1,
		stopThreshold: 0.2,

	},
	billiards: {
		friction: 0.94,
		linearDrag: 0.15,
		stopThreshold: 0.2,
	},
	carpet_office: {
		friction: 0.91,
		linearDrag: 0.25,
		stopThreshold: 0.3,
	},
	gym: {
		friction: 0.88,
		linearDrag: 0.4,
		stopThreshold: 0.4,
	},
	turf: {
		friction: 0.82,
		linearDrag: 0.8,
		stopThreshold: 0.5,

	},
	asphalt: {
		friction: 0.75,
		linearDrag: 1.2,
		stopThreshold: 0.6,
	},
	grass: {
		friction: 0.6,
		linearDrag: 2.5,
		stopThreshold: 1.0,
	},
	sand: {
		friction: 0.4,
		linearDrag: 5.0,
		stopThreshold: 2.0,
	}
} as const

export type SettingsMap = { screenResolution: SettingsScreenResolution, mapBoundarys: MapBoundarySettings<EffectType, EffectTrigger>[], background: SettingsBackground }

const playerSize = 14
const defaultHoop = AssetList.pictureReifenWEBP
export const GameSettings: GameSettings = {
	id: "8a67d1b0-5c76-4348-bc7a-012d8c9746cc",
	players: [
		/* Formation LINKS (3x2) */
		{ id: "300591aa-e47e-4708-8da8-e8feb9938555", x: 100, y: 100, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: ["1"], size: playerSize, hoop: defaultHoop },
		{ id: "46d4ce14-0437-4a01-a99f-7bddff12e507", x: 200, y: 100, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: ["1"], size: playerSize, hoop: defaultHoop },
		{ id: "1a4f0fd9-4a26-4ac5-8332-c18b68f4f084", x: 100, y: 200, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: ["1"], size: playerSize, hoop: defaultHoop },
		{ id: "1ea70b24-bb63-4346-ad58-dcc85f2f3bbb", x: 200, y: 200, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: ["1"], size: playerSize, hoop: defaultHoop },
		{ id: "2663d694-7e93-4a1c-8fb8-9b905e3174a8", x: 90, y: 300, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: ["1"], size: playerSize, hoop: defaultHoop },
		{ id: "26a4b2f4-228f-449b-babf-ad935723bc73", x: 200, y: 300, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: ["1"], size: playerSize, hoop: defaultHoop },
		//
		// /* Formation RECHTS (3x2) */
		{ id: "2ce98548-ab1e-482a-8130-fd270233cd97", x: 600, y: 100, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: ["2"], size: playerSize, hoop: defaultHoop },
		{ id: "ff8e2c75-da89-4d54-b2fa-fbec418d0200", x: 700, y: 100, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: ["2"], size: playerSize, hoop: defaultHoop },
		{ id: "f71b2986-d32a-46a0-8fb4-e8f95beb8de9", x: 700, y: 200, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: ["2"], size: playerSize, hoop: defaultHoop },
		{ id: "f2c7eb70-aebd-4231-ba9d-4f5fa2d547cd", x: 600, y: 200, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: ["2"], size: playerSize, hoop: defaultHoop },
		{ id: "58e7ac62-98fa-4552-87d0-49689a27a484", x: 600, y: 300, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: ["2"], size: playerSize, hoop: defaultHoop },
		{ id: "3f66b025-978b-4de9-8032-996440744939", x: 700, y: 300, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: ["2"], size: playerSize, hoop: defaultHoop }
	],
	friction: FRICTION_TABLE.ice,
	items: [],
	effects: [],
	allTeam: ["1", "2"],
	team: ["1"],
	...MAPS.IceMap,
}
