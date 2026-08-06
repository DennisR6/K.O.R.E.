import type { UUID } from "node:crypto";
import { GameState } from "../engine/types.js";
import { currentTurnMode } from "../rules/defaultGameModes.js";
import { RuleInterpreter } from "../rules/RuleInterpreter.js";
import { RulePhase } from "../rules/types.js";
import type { IGameContext, ISerializableSystem, SystemSettings } from "./types.js";
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
export class RoundPlayerSystem implements ISerializableSystem<SystemSettings> {
	public readonly systemId = "core.round-player";
	teams: UUID[]
	private rules = new RuleInterpreter(currentTurnMode)
	/** Interner Flag, um den aktuellen Besitzer des Zuges zu tracken. */
	constructor(teams: UUID[]) { this.teams = teams }
	public toSettings(): SystemSettings { return { systemId: this.systemId, schemaVersion: 1, state: { teams: [...this.teams] } }; }
	/**
	 * Prüft den Spielzustand und wechselt die Runde, sobald die Action vorbei ist.
	 */
	ticker(ctx: IGameContext, _dt: number): void {
		if (ctx.state !== GameState.ChooseTeam) return
		const nextTurn = this.rules.startNextTurn({ phase: RulePhase.Complete, activeTeam: ctx.activeTeam, turnNumber: ctx.currTurn, itemUses: 0 }, this.teams.length)
		ctx.activeTeam = nextTurn.activeTeam
		ctx.currTurn = nextTurn.turnNumber
		ctx.state = TurnSystem.stateForTeam(ctx.activeTeam, [ctx.myTeamNumber])
	}
}

/** @deprecated Use RuleInterpreter.nextActiveTeam(). */
export const getNextNumber = (a: number, b: number) => new RuleInterpreter(currentTurnMode).nextActiveTeam(a, b)
