import type { RenderContext } from "../engine/RenderContext.js";
import type { EffectParams, Frequency, IItem, Spawn } from "./Items.js";
import type { IGameContext } from "../systems/types.js"
import { GameState, type GameStateType } from "../engine/types.js";
import { ItemCollector } from "./ItemCollector.js";


export class ItemWall implements IItem {
	id?: string;
	name?: string;
	effectType?: string;
	trigger?: string;
	frequency?: Frequency;
	probability?: number;
	spawn?: Spawn;
	effectParams?: EffectParams;
	private lastState: GameStateType;
	private roundsActive: number = 0;
	private readonly MAX_ROUNDS = 10;
	private wallId: string = "wall_" + Math.random().toString(36).substr(2, 9);
	private isSpawned: boolean = false;


	constructor(item: Partial<IItem>) {
		this.effectParams = item.effectParams
		this.effectType = item.effectType
		this.frequency = item.frequency
		this.id = item.id
		this.name = item.name
		this.probability = item.probability
		this.spawn = item.spawn
		this.trigger = item.trigger
		this.lastState = GameState.YOUR_TURN

	}
	draw(_ctx: RenderContext): void { }

	ticker(ctx: IGameContext, _dt: number, _gf: number) {
		// Nur reagieren, wenn der Status sich geändert hat
		if (this.lastState === ctx.state) return;
		this.lastState = ctx.state;

		// Wir zählen nur, wenn der Zustand "YOUR_TURN" erreicht wird
		if (this.lastState === GameState.YOUR_TURN) return
		if (this.roundsActive < this.MAX_ROUNDS) {
			// Wand spawnen, falls noch nicht geschehen
			if (!this.isSpawned) {
				const wall = new ItemCollector();
				(wall as any).id = this.wallId;
				ctx.structures.push(wall);
				this.isSpawned = true;
			}
			this.roundsActive++;
		} else if (this.isSpawned) {
			// Wand entfernen nach 3 Runden
			ctx.structures = ctx.structures.filter(s => (s as any).id !== this.wallId);
			this.isSpawned = false;
		}
		console.log(ctx.structures)
	}
	tick(_deltatime: number, _globalfriction: number): void { }
}
