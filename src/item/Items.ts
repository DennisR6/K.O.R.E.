import type { IDrawer, ITicker } from "../engine/RenderContext.js";
import type { ISystem } from "../systems/Systems.js";

export interface IItem extends IDrawer, ITicker, ISystem {
	id?: string;
	name?: string;
	effectType?: string;
	trigger?: string;
	frequency?: Frequency;
	probability?: number;
	spawn?: Spawn;
	effectParams?: EffectParams;
}

export interface EffectParams { }

export interface Frequency {
	mode?: string;
	intervalRounds?: number;
	killsInterval?: number;
	lastPlayersThreshold?: number;
	healthThreshold?: number;
	boostFactor?: number;
}

export interface Spawn {
	type?: string;
	points?: any[];
	areas?: Area[];
}

export interface Area {
	shape?: string;
	x?: number;
	y?: number;
	radius?: number;
	width?: number;
	height?: number;
}

