import type { IInputEmitter } from "../engine/types.js";
import { GameLogger } from "../utils/log.js";

/**
 * Der Netzwerk-Emitter.
 * 
 * Dieser Emitter ist "Subject to Change". 
 * Er wird aktuell noch mit 'any' für den Socket betrieben und muss 
 * im Zuge der Auslagerung in ein eigenes Package stabilisiert werden.
 */
export class NetworkEmitter implements IInputEmitter {
	socket: WebSocket

	constructor(socket: WebSocket) {
		this.socket = socket
	}

	/**
	 * Sendet den Schuss an den Server.
	 * 
	 * Die Event-Struktur ('shoot') und die Payload 
	 * könnten sich ändern, sobald das Netzwerk-Protokoll finalisiert ist.
	 */
	sendShot(actorId: string | number, angle: number, power: number): void {
		GameLogger.info(actorId, angle, power)
		this.socket.send(JSON.stringify({ type: "shoot", actorId, angle, power }))
	}
}
