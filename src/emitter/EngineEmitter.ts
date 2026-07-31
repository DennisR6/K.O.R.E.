import type { GameHandler } from "../engine/Handler.js";
import { type IInputEmitter } from "../engine/types.js";
import { currentTurnMode } from "../rules/defaultGameModes.js";
import { RuleInterpreter } from "../rules/RuleInterpreter.js";
import { RulePhase, type GameModeSettings, type RuleState } from "../rules/types.js";
import { TurnSystem } from "../systems/TurnSystem.js";
import type { ItemTarget } from "../item/target.js";
import { ReplayRecorder } from "../replay/recorder.js";

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
	public recorder: ReplayRecorder
	constructor(handler: GameHandler, mode: GameModeSettings = currentTurnMode, teamCount: number = handler.getTeam().length, seed: number = 12345) {
		if (teamCount < 1) throw new Error("Local game requires at least one team")
		this.handler = handler
		this.rules = new RuleInterpreter(mode)
		this.ruleState = handler.getRuleState()
		this.teamCount = teamCount
		const settings = typeof (handler as any).toSettings === "function" ? (handler as any).toSettings() : ((handler as any).settings ?? { schemaVersion: 1, id: crypto.randomUUID(), screenResolution: { x: 16, y: 9 }, worldSize: { x: 16, y: 9 }, players: [], mapBoundarys: [], background: { type: "color", color: "#000" }, friction: { friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 }, drift: 0, effects: [], items: [], myTeam: [], allTeamSize: 2, playerCount: 2, figuresPerPlayer: 6, minPlayers: 2, maxPlayers: 2 });
		this.recorder = new ReplayRecorder(settings, seed)
	}

	sendShot(actorId: string, angle: number, power: number): void {
		this.ruleState = this.handler.getRuleState()
		if (this.ruleState.phase !== RulePhase.Physics) throw new Error("Local shot is not in the physics phase")
		this.recorder.recordShoot(actorId, angle, power)
		console.log("Recieved Turn: ", JSON.stringify({ actorId, angle, power }))
		const sim = this.handler.simulateTurn(actorId, angle, power)
		// this.handler.setState(GameState.Playing)
		this.handler.playTurn(sim, () => {
			this.ruleState = this.rules.advancePhase(this.ruleState)
			this.ruleState = this.rules.startNextTurn(this.ruleState, this.teamCount)
			const startTurn = (this.handler as Partial<GameHandler>).startTurn
			if (startTurn) startTurn.call(this.handler, this.ruleState)
			else {
				this.handler.setActiveTeam(this.ruleState.activeTeam)
				this.handler.setTurnNumber(this.ruleState.turnNumber)
				this.handler.setRuleState(this.ruleState)
			}
			this.handler.setState(TurnSystem.stateForTeam(this.ruleState.activeTeam, this.handler.getTeam()))
			this.handler.setState(TurnSystem.stateForTeam(this.ruleState.activeTeam, this.handler.getTeam()))
		})
	}

	sendItemUse(actorId: string, itemId: string, target: ItemTarget): void {
		this.ruleState = this.handler.getRuleState()
		if (this.ruleState.phase !== RulePhase.Item) throw new Error("Local item use is not in the item phase")
		this.recorder.recordItemUse(actorId, itemId, target)
		this.handler.useItem(actorId, itemId, target)
		this.ruleState = this.rules.useItem(this.ruleState)
		this.handler.setRuleState(this.ruleState)
		this.handler.setState(TurnSystem.stateForTeam(this.ruleState.activeTeam, this.handler.getTeam()))
	}
}
