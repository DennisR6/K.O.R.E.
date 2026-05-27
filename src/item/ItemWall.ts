import type { ItemSettings } from "./Items.js";
import type { IGameContext } from "../systems/types.js"
import { GameState, type GameStateType } from "../engine/types.js";
import { ItemCollector } from "./ItemCollector.js";
import { MinimalItem } from "./minimalItem.js";


export class ItemWall extends MinimalItem {
	private lastState: GameStateType;
	private roundsActive: number = 0;
	private readonly MAX_ROUNDS = 10;
	private wallId: string = crypto.randomUUID();
	private isSpawned: boolean = false;

	constructor(item: Partial<ItemSettings>) {
		super(item)
		this.lastState = GameState.YOUR_TURN
	}

	ticker(ctx: IGameContext, _dt: number, _gf: number) {
		// Nur reagieren, wenn der Status sich geändert hat
		if (this.lastState === ctx.state) return;
		this.lastState = ctx.state;

		// Wir zählen nur, wenn der Zustand "YOUR_TURN" erreicht wird
		if (this.lastState === GameState.YOUR_TURN) return
		if (this.roundsActive < this.MAX_ROUNDS) {
			// Wand spawnen, falls noch nicht geschehen
			if (!this.isSpawned) {
				const wall = new ItemCollector({});
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
}
