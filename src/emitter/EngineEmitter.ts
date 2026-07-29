import type { GameHandler } from "../engine/Handler.js";
import { type IInputEmitter } from "../engine/types.js";
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
	constructor(handler: GameHandler) { this.handler = handler }

	sendShot(actorId: string, angle: number, power: number): void {
		console.log("Recieved Turn: ", JSON.stringify({ actorId, angle, power }))
		const sim = this.handler.simulateTurn(actorId, angle, power)
		// this.handler.setState(GameState.Playing)
		this.handler.playTurn(sim, () => {
			const activeTeam = this.handler.advanceTurn()
			this.handler.setState(TurnSystem.stateForTeam(activeTeam, this.handler.getTeam()))
		})
	}
}
