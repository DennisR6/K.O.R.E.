import type { GameHandler } from "../engine/Handler";
import type { IInputEmitter } from "../engine/types";
import { GameLogger, LogLevel } from "../utils/log";

export class GameEmitter implements IInputEmitter {
	handler: GameHandler
	constructor(handler: GameHandler) {
		this.handler = handler
	}
	sendShot(actorId: string | number, angle: number, power: number): void {
		console.log({ actorId, angle, power })
		const turn = this.handler.simulateTurn(actorId, angle, power)
		GameLogger.info(LogLevel.INFO, "Recieved Turn: ", JSON.stringify(turn))
		this.handler.tickTurn(turn)
	}
}
