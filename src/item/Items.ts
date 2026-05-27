import type { IDrawer, ITicker } from "../engine/RenderContext.js";
import type { ISystem } from "../systems/Systems.js";


export interface ItemSettings {
	id: string;
	name: string;
	effectType: string[];
	trigger: string;
	frequency: Frequency;
	probability: number;
	spawn: Spawn;
	effectParams: EffectParams[];
}

export interface IItem extends IDrawer, ITicker, ISystem {
	setId(id: string): void
	getId(): string

	setName(name: string): void
	getName(): string

	setTrigger(trigger: string): void
	getTrigger(): string;

	setFrequency(freq: Frequency): void
	getFrequency(): Frequency;

	setProbability(prob: number): void
	getProbability(): number;

	setSpawn(spawn: Spawn): void
	getSpawn(): Spawn;

	setEffectParams(effectParams: EffectParams[]): void
	getEffectParams(): EffectParams[];
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

