import type { UUID } from "node:crypto";
import { GameState } from "../engine/types.js";
import type { IGameContext, ISystem } from "./types.js";
import { TurnSystem } from "./TurnSystem.js";

/**
 * Ein minimalistisches Rundensystem ohne Spielerwechsel.
 * 
 * Wird hauptsächlich für Debugging oder Single-Player Modi genutzt.
 * Sobald eine Simulation beendet ist (`PLAYING_DONE`), wird der Zustand 
 * sofort wieder auf `YOUR_TURN` gesetzt.
 */
// export class NoRoundSystem implements ISystem {
// 	ticker(ctx: IGameContext, _dt: number): void {
// 		if (ctx.state !== GameState.TURN_DONE) return;
// 		ctx.state = GameState.YOUR_TURN;
// 	}
// }

/**
 * Das Standard-Rundensystem für X-Spieler-Duelle.
 * 
 * Es fungiert als Zustandsautomat (State Machine), der nach jedem 
 * abgeschlossenen Zug zwischen dem eigenen und dem gegnerischen Zug wechselt.
 */
export class RoundPlayerSystem implements ISystem {
	teams: UUID[]
	/** Interner Flag, um den aktuellen Besitzer des Zuges zu tracken. */
	constructor(teams: UUID[]) { this.teams = teams }
	/**
	 * Prüft den Spielzustand und wechselt die Runde, sobald die Action vorbei ist.
	 */
	ticker(ctx: IGameContext, _dt: number): void {
		if (ctx.state !== GameState.ChooseTeam) return
		ctx.activeTeam = TurnSystem.nextActiveTeam(ctx.activeTeam, this.teams.length)
		ctx.currTurn++
		ctx.state = TurnSystem.stateForTeam(ctx.activeTeam, [ctx.myTeamNumber])
	}
}

/** @deprecated Use TurnSystem.nextActiveTeam(). */
export const getNextNumber = (a: number, b: number) => TurnSystem.nextActiveTeam(a, b)
