export interface Settings {
	mapBoundarys?: MapBoundary[];
	players?: SettingsEntity[];
	friction?: FrictionSettings;
	effects?: SettingsEffect[];
	items?: SettingsItem[];
	background?: SettingsBackground;
	screenResolution: SettingsScreenResolution;
	id: string,
}

export interface SettingsScreenResolution {
	x: number,
	y: number,
}

export type SettingsBackground = SettingsBackgroundColor | SettingsBackgroundImage

export interface SettingsBackgroundImage {
	type: "image"
	url: string
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
	color: string;
}

export interface MapBoundaryLine extends IMapBoundary {
	type: "line"
	x2: number;
	y2: number;
	color: string;
}

export interface MapBoundaryRect extends IMapBoundary {
	type: "rectangle"
	w: number;
	h: number;
	color: string;
}

export interface SettingsEntity {
	id: string | number;
	x: number;
	y: number;
	size?: number;
	color: string;
	team: string[];
	playericon: string;
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
const thickness = 2
const CircleRadius = 27
export const GameSettings = {
	id: "",
	screenResolution: { x: 800, y: 450 },
	mapBoundarys: [
		// Rectangles
		{ type: "rectangle", x: 425, y: 57, w: 285, h: thickness, color: "green" },
		{ type: "rectangle", x: 85, y: 57, w: 274, h: thickness, color: "black" },
		{ type: "rectangle", x: 56, y: 83, w: thickness, h: 261, color: "blue" },
		{ type: "rectangle", x: 425, y: 365, w: 285, h: thickness, color: "cyan" },
		{ type: "rectangle", x: 85, y: 365, w: 274, h: thickness, color: "purple" },
		{ type: "rectangle", x: 740, y: 83, w: thickness, h: 261, color: "red" },


		// Circles
		{ type: "circle", x: 50, y: 48, r: CircleRadius, color: "blue" },
		// OBEN MITTE
		{ type: "circle", x: 391, y: 35, r: CircleRadius, color: "yellow" },
		// OBEN RECHTS
		{ type: "circle", x: 749, y: 46, r: CircleRadius, color: "purple" },
		// UNTEN LINKS
		{ type: "circle", x: 50, y: 380, r: CircleRadius, color: "magenta" },
		// UNTEN MITTE
		{ type: "circle", x: 391, y: 390, r: CircleRadius, color: "red" },
		// UNTEN RECHTS
		{ type: "circle", x: 745, y: 380, r: CircleRadius, color: "cyan" },
	],
	players: [
		{ id: "debug", x: 200, y: 145, color: "green", playericon: "/arena.png", team: ["0"], size: 20 },
		{ id: "0", x: 320, y: 200, color: "red", playericon: "", team: ["1"], size: 20 },
	],
	friction: FRICTION_TABLE.wood,
	items: [{ type: "", id: 0 }],
	effects: [],
	background: { type: "image", url: "/eis.png" },
	music: ["/..."]
} as Settings
