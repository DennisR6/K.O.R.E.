import type { RenderContext } from "../engine/RenderContext";
import type { IGameContext } from "../systems/types";
import type { EffectParams, Frequency, IItem, Spawn } from "./Items";

export class MinimalItem implements IItem {
	id?: string;
	name?: string;
	effectType?: string;
	trigger?: string;
	frequency?: Frequency;
	probability?: number;
	spawn?: Spawn;
	effectParams?: EffectParams[];

	constructor(item: Partial<IItem>) {
		this.effectParams = item.effectParams
		this.effectType = item.effectType
		this.frequency = item.frequency
		this.id = item.id
		this.name = item.name
		this.probability = item.probability
		this.spawn = item.spawn
		this.trigger = item.trigger

	constructor(item: Partial<ItemSettings>) {
		this.effectParams = item.effectParams ?? [];
		this.effectType = item.effectType ?? [];
		this.frequency = item.frequency ?? {
			boostFactor: 0,
			healthThreshold: 0,
			intervalRounds: 0,
			killsInterval: 0,
			lastPlayersThreshold: 0,
			mode: ""
		};
		this.id = item.id ?? crypto.randomUUID();
		this.name = item.name ?? "MinimalItem";
		this.probability = item.probability ?? 1;
		this.spawn = item.spawn ?? { areas: [], points: [], type: "" };
		this.trigger = item.trigger ?? "";
	}

	tick(_deltatime: number, _globalfriction: number): void { }
	draw(_ctx: RenderContext): void { }
	ticker(_ctx: IGameContext, _dt: number, _friction: number): void { }
}



