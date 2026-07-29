import type { GameHandler } from "../engine/Handler.js";
import { type IInputEmitter } from "../engine/types.js";
import { currentTurnMode } from "../rules/defaultGameModes.js";
import { RuleInterpreter } from "../rules/RuleInterpreter.js";
import { RulePhase, type GameModeSettings, type RuleState } from "../rules/types.js";
import { TurnSystem } from "../systems/TurnSystem.js";

/**
 * Der "Local Player" Emitter.
 * 
 * Er leitet Eingaben ohne Umwege direkt wieder in die Engine zurück.
 * Ideal für den Singleplayer-Modus oder lokale Tests, da kein Server
 * benötigt wird, um den Spielzug zu verarbeiten.
 */
export class GameEmitter implements IInputEmitter {
	handler: GameHandler
	private rules: RuleInterpreter
	private ruleState: RuleState
	private teamCount: number
	constructor(handler: GameHandler, mode: GameModeSettings = currentTurnMode, teamCount: number = handler.getTeam().length) {
		if (teamCount < 1) throw new Error("Local game requires at least one team")
		this.handler = handler
		this.rules = new RuleInterpreter(mode)
		this.ruleState = handler.getRuleState()
		this.teamCount = teamCount
	}

	sendShot(actorId: string, angle: number, power: number): void {
		if (this.ruleState.phase !== RulePhase.Physics) throw new Error("Local shot is not in the physics phase")
		console.log("Recieved Turn: ", JSON.stringify({ actorId, angle, power }))
		const sim = this.handler.simulateTurn(actorId, angle, power)
		// this.handler.setState(GameState.Playing)
		this.handler.playTurn(sim, () => {
			this.ruleState = this.rules.advancePhase(this.ruleState)
			this.ruleState = this.rules.startNextTurn(this.ruleState, this.teamCount)
			this.handler.setActiveTeam(this.ruleState.activeTeam)
			this.handler.setTurnNumber(this.ruleState.turnNumber)
			this.handler.setRuleState(this.ruleState)
			this.handler.setState(TurnSystem.stateForTeam(this.ruleState.activeTeam, this.handler.getTeam()))
		})
	}
}
