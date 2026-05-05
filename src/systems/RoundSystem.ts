import { GameState } from "../engine/types";
import { GameLogger } from "../utils/log";
import type { IGameContext, ISystem } from "./types";

/**
 * Ein minimalistisches Rundensystem ohne Spielerwechsel.
 * 
 * Wird hauptsächlich für Debugging oder Single-Player Modi genutzt.
 * Sobald eine Simulation beendet ist (`PLAYING_DONE`), wird der Zustand 
 * sofort wieder auf `YOUR_TURN` gesetzt.
 */
export class NoRoundSystem implements ISystem {
	tick(ctx: IGameContext, _dt: number): void {
		if (ctx.state !== GameState.PLAYING_DONE) return;
		ctx.state = GameState.YOUR_TURN;
	}
}

/**
 * Das Standard-Rundensystem für 2-Spieler-Duelle.
 * 
 * Es fungiert als Zustandsautomat (State Machine), der nach jedem 
 * abgeschlossenen Zug zwischen dem eigenen und dem gegnerischen Zug wechselt.
 */
export class Round2PlayerSystem implements ISystem {
	/** Interner Flag, um den aktuellen Besitzer des Zuges zu tracken. */
	private yourTurn: boolean = false;

	/**
	 * Prüft den Spielzustand und wechselt die Runde, sobald die Action vorbei ist.
	 */
	tick(ctx: IGameContext, _dt: number): void {
		if (ctx.state !== GameState.PLAYING_DONE) return;

		if (this.yourTurn) {
			GameLogger.debug(ctx.state, GameState.YOUR_TURN);
			ctx.state = GameState.YOUR_TURN;
		} else {
			GameLogger.debug(ctx.state, GameState.OPPONENTS_TURN);
			ctx.state = GameState.OPPONENTS_TURN;
		}

		this.yourTurn = !this.yourTurn;
	}
}
