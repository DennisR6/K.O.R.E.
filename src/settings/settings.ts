import { type AssetKey, AssetList } from "../assetManager/assets/assetRegistry.js";

export interface GameSettings {
	mapBoundarys?: MapBoundary[];
	hazzards?: MapBoundary[];
	players?: SettingsEntity[];
	friction?: FrictionSettings;
	effects?: SettingsEffect[];
	items?: SettingsItem[];
	background?: SettingsBackground;
	screenResolution: SettingsScreenResolution;
	team: string[],
	id: string
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

export interface SettingsEffect {
	id: string;
	type: string;
	value: number;
}

export type MapBoundary = MapBoundaryCircle | MapBoundaryLine | MapBoundaryRect
export interface IMapBoundary {
	x: number;
	y: number;
}
export interface MapBoundaryCircle extends IMapBoundary {
	type: "circle"
	r: number;
	color?: string;
}

export interface MapBoundaryLine extends IMapBoundary {
	type: "line"
	x2: number;
	y2: number;
	color?: string;
}

export interface MapBoundaryRect extends IMapBoundary {
	type: "rectangle"
	w: number;
	h: number;
	color?: string;
}

export interface SettingsEntity {
	id: string | number;
	x: number;
	y: number;
	size?: number;
	color?: string;
	team: string[];
	playericon: AssetList;
	hoop: AssetList;
}

export interface SettingsItem {
	type: string
	id: number
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


const playerSize = 14
const thickness = 2
const [x, y] = [800, 450]
const offset = 30
const CircleRadius = 15
const debugColorStruct = undefined
const defaultHoop = AssetList.pictureReifenWEBP
export const GameSettings = {
	id: "0",
	screenResolution: { x, y },
	mapBoundarys: [
		// Rectangles
		{ type: "rectangle", x: 45, y: 75, w: thickness, h: 300, color: debugColorStruct },
		{ type: "rectangle", x: 75, y: 45, w: 300, h: thickness, color: debugColorStruct },
		{ type: "rectangle", x: 425, y: 45, w: 300, h: thickness, color: debugColorStruct },
		{ type: "rectangle", x: 75, y: 405, w: 300, h: thickness, color: debugColorStruct },
		{ type: "rectangle", x: 425, y: 405, w: 300, h: thickness, color: debugColorStruct },
		{ type: "rectangle", x: 800 - 45, y: 75, w: thickness, h: 300, color: debugColorStruct },

		//RASTER
		// { type: "rectangle", x: 0, y: 0, w: 800, h: 450, color: "cyan" },
		// { type: "rectangle", x: x - offset, y: 100, w: thickness, h: y / 2, color: "black" },
		{ type: "rectangle", x: x / 2, y: y / 3, w: thickness, h: y / 3, color: "black" },
	],
	hazzards: [
		{ type: "circle", x: offset + CircleRadius, y: offset + CircleRadius, r: CircleRadius, color: debugColorStruct },
		// Circles
		// OBEN MITTE
		{ type: "circle", x: x / 2, y: offset + 5, r: CircleRadius, color: debugColorStruct },
		// OBEN RECHTS
		{ type: "circle", x: (x - offset - CircleRadius), y: offset + CircleRadius, r: CircleRadius, color: debugColorStruct },
		// TEST
		// { type: "circle", x: (800 - CircleRadius) / 2, y: y / 2, r: CircleRadius, color: "magenta" },
		// UNTEN LINKS
		{ type: "circle", x: offset + 10, y: 408, r: CircleRadius, color: debugColorStruct },
		// UNTEN MITTE
		{ type: "circle", x: x / 2, y: 413, r: CircleRadius, color: debugColorStruct },
		// UNTEN RECHTS
		{ type: "circle", x: 760, y: 408, r: CircleRadius, color: debugColorStruct },
	],
	players: [
		/* Formation LINKS (3x2) */
		{ id: 0, x: 100, y: 100, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: ["1"], size: playerSize, hoop: defaultHoop },
		{ id: 1, x: 200, y: 100, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: ["1"], size: playerSize, hoop: defaultHoop },
		{ id: 2, x: 100, y: 200, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: ["1"], size: playerSize, hoop: defaultHoop },
		{ id: 3, x: 200, y: 200, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: ["1"], size: playerSize, hoop: defaultHoop },
		{ id: 4, x: 90, y: 300, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: ["1"], size: playerSize, hoop: defaultHoop },
		{ id: 5, x: 200, y: 300, playericon: AssetList.picturePenguinPenguinIdleFrame1WEBP, team: ["1"], size: playerSize, hoop: defaultHoop },
		//
		// /* Formation RECHTS (3x2) */
		{ id: 6, x: 650, y: 100, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: ["2"], size: playerSize },
		{ id: 7, x: 700, y: 100, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: ["2"], size: playerSize },
		{ id: 8, x: 700, y: 200, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: ["2"], size: playerSize },
		{ id: 9, x: 600, y: 200, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: ["2"], size: playerSize },
		{ id: 10, x: 600, y: 300, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: ["2"], size: playerSize },
		{ id: 11, x: 700, y: 300, playericon: AssetList.picturePolarBearPolarBearIdleFrame1WEBP, team: ["2"], size: playerSize }
	],
	friction: FRICTION_TABLE.ice,
	items: [
		{ type: "", id: 0 }
	],
	effects: [
		{ id: "", type: "", value: 0 },
	],
	background: { type: "image", url: AssetList.billiardGrosserLochJungePNG },
	music: [
		"/..."
	],
	team: ["1"]
} as GameSettings
