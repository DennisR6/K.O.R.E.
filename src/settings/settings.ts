export interface Settings {
	mapBoundarys?: MapBoundary[];
	hazzards?: MapBoundary[];
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
	color?: string;
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
const [x, y] = [800, 450]
const offset = 30
const playerSize = 15
const CircleRadius = 10
const debugColorStruct = "transparent"
export const GameSettings = {
	id: "",
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
		// { type: "rectangle", x: offset, y: 100, w: thickness, h: y / 2, color: "black" },
		// { type: "rectangle", x: x - offset, y: 100, w: thickness, h: y / 2, color: "black" },
		// { type: "rectangle", x: x / 2, y: 100, w: thickness, h: y / 2, color: "black" },
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
		// { "x": 57.99526427344503, "y": 324.76779335442063 }
		/* Formation LINKS (3x2) */
		{ id: 1, x: 100, y: 100, playericon: "/picture/penguin/Penguin_Idle_Frame_1.png", team: ["1"], size: playerSize },
		{ id: 2, x: 200, y: 100, playericon: "/picture/penguin/Penguin_Idle_Frame_1.png", team: ["1"], size: playerSize },
		{ id: 3, x: 100, y: 200, playericon: "/picture/penguin/Penguin_Idle_Frame_1.png", team: ["1"], size: playerSize },
		{ id: 4, x: 200, y: 200, playericon: "/picture/penguin/Penguin_Idle_Frame_1.png", team: ["1"], size: playerSize },
		{ id: 5, x: 90, y: 300, playericon: "/picture/penguin/Penguin_Idle_Frame_1.png", team: ["1"], size: playerSize },
		{ id: 6, x: 200, y: 300, playericon: "/picture/penguin/Penguin_Idle_Frame_1.png", team: ["1"], size: playerSize },
		//
		// /* Formation RECHTS (3x2) */
		{ id: 7, x: 600, y: 100, playericon: "/picture/Polar_Bear/Polar_Bear_Idle_Frame_1.png", team: ["2"], size: playerSize },
		{ id: 8, x: 700, y: 100, playericon: "/picture/Polar_Bear/Polar_Bear_Idle_Frame_1.png", team: ["2"], size: playerSize },
		{ id: 9, x: 700, y: 200, playericon: "/picture/Polar_Bear/Polar_Bear_Idle_Frame_1.png", team: ["2"], size: playerSize },
		{ id: 10, x: 600, y: 200, playericon: "/picture/Polar_Bear/Polar_Bear_Idle_Frame_1.png", team: ["2"], size: playerSize },
		{ id: 11, x: 600, y: 300, playericon: "/picture/Polar_Bear/Polar_Bear_Idle_Frame_1.png", team: ["2"], size: playerSize },
		{ id: 12, x: 700, y: 300, playericon: "/picture/Polar_Bear/Polar_Bear_Idle_Frame_1.png", team: ["2"], size: playerSize }
	],
	friction: FRICTION_TABLE.ice,
	items: [{ type: "", id: 0 }],
	effects: [],
	background: { type: "image", url: "/BilliardGroßerLochJunge.png" },
	music: ["/..."]
} as Settings
