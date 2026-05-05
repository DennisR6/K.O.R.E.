import type { GameHandler } from "../engine/Handler";
import type { IInputEmitter } from "../engine/types";
import { GameLogger, LogLevel } from "../utils/log";

/**
 * Der "Local Player" Emitter.
 * 
 * Er leitet Eingaben ohne Umwege direkt wieder in die Engine zurück.
 * Ideal für den Singleplayer-Modus oder lokale Tests, da kein Server
 * benötigt wird, um den Spielzug zu verarbeiten.
 */
export class GameEmitter implements IInputEmitter {
	handler: GameHandler
	/**
		 * @param handler - Die Engine-Instanz, die den Zug ausführen soll.
		 */
	constructor(handler: GameHandler) {
		this.handler = handler
	}

	/**
		 * Nimmt den Schuss-Befehl entgegen und triggert sofort 
		 * die Simulation sowie die anschließende Animation.
		 */
	sendShot(actorId: string | number, angle: number, power: number): void {
		// 1. In die Glaskugel schauen (Simulation berechnen)
		const turn = this.handler.simulateTurn(actorId, angle, power)

		GameLogger.info(LogLevel.INFO, "Recieved Turn: ", JSON.stringify(turn))

		// 2. Den berechneten Zug auf der Leinwand abspielen
		this.handler.tickTurn(turn)
	}
}
