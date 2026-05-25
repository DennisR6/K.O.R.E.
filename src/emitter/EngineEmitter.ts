import type { GameHandler } from "../engine/Handler.js";
import type { IInputEmitter } from "../engine/types.js";
import { GameLogger, LogLevel } from "../utils/log.js";

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

	sendShot(actorId: string | number, angle: number, power: number): void {
		GameLogger.info(LogLevel.INFO, "Recieved Turn: ", JSON.stringify({ actorId, angle, power }))
		const sim = this.handler.simulateTurn(actorId, angle, power)
		this.handler.tickTurn(sim)
	}
}
