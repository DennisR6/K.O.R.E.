import { GameState } from "../engine/types";
import { GameLogger } from "../utils/log";
import type { IGameContext, ISystem } from "./types";

export class NoRoundSystem implements ISystem {
	update(ctx: IGameContext, _dt: number): void {
		if (ctx.state !== GameState.PLAYING_DONE) return;
		ctx.state = GameState.YOUR_TURN
	}
}
export class Round2PlayerSystem implements ISystem {
	private yourTurn: boolean = false;
	update(ctx: IGameContext, _dt: number): void {
		if (ctx.state !== GameState.PLAYING_DONE) return;
		if (this.yourTurn) {
			GameLogger.debug(ctx.state, GameState.YOUR_TURN)
			ctx.state = GameState.YOUR_TURN
		} else {
			GameLogger.debug(ctx.state, GameState.OPPONENTS_TURN)
			// ctx.state = GameState.OPPONENTS_TURN
			ctx.state = GameState.YOUR_TURN
		}
		this.yourTurn = !this.yourTurn;
		console.log("Runde gewechselt. Neuer State:", ctx.state);
	}
}
