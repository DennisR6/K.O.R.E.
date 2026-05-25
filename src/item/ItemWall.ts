import type { RenderContext } from "../engine/RenderContext.js";
import type { EffectParams, Frequency, IItem, Spawn } from "./Items.js";
import type { IGameContext } from "../systems/types.js"
import { StructureCircle } from "../structures/structureCircle.js";

export class ItemWall implements IItem {
	id?: string;
	name?: string;
	effectType?: string;
	trigger?: string;
	frequency?: Frequency;
	probability?: number;
	spawn?: Spawn;
	effectParams?: EffectParams;
	constructor(item: Partial<IItem>) {
		this.effectParams = item.effectParams
		this.effectType = item.effectType
		this.frequency = item.frequency
		this.id = item.id
		this.name = item.name
		this.probability = item.probability
		this.spawn = item.spawn
		this.trigger = item.trigger
	}
	draw(_ctx: RenderContext) { }
	ticker(ctx: IGameContext, _dt: number, _gf: number) {
		ctx.structures.push(new StructureCircle(100, 100, 20, "green"))
	}
	tick(_deltatime: number, _globalfriction: number): void { }
}
