import type { Socket } from "socket.io-client";
import type { IInputEmitter } from "../engine/types";

/**
 * Der Netzwerk-Emitter.
 * 
 * @deprecated Dieser Emitter ist "Subject to Change". 
 * Er wird aktuell noch mit 'any' für den Socket betrieben und muss 
 * im Zuge der Auslagerung in ein eigenes Package stabilisiert werden.
 */
export class SocketEmitter implements IInputEmitter {
	socket: Socket

	constructor(socket: Socket) {
		this.socket = socket
	}

	/**
	 * Sendet den Schuss an den Server.
	 * 
	 * @deprecated Die Event-Struktur ('shoot') und die Payload 
	 * könnten sich ändern, sobald das Netzwerk-Protokoll finalisiert ist.
	 */
	sendShot(actorId: string | number, angle: number, power: number): void {
		console.log(actorId, angle, power)
		this.socket.emit('shoot', { actorId, angle, power });
	}
}
