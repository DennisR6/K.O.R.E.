import type { IInputEmitter } from "../engine/types.js";
import type { UUID } from "crypto";

/**
 * Der Netzwerk-Emitter.
 * 
 * Dieser Emitter ist "Subject to Change". 
 * Er wird aktuell noch mit 'any' für den Socket betrieben und muss 
 * im Zuge der Auslagerung in ein eigenes Package stabilisiert werden.
 */
export class NetworkEmitter implements IInputEmitter {
	socket: WebSocket
	userid: UUID
	gameid: UUID

	constructor(socket: WebSocket, userid: UUID, gameid: UUID) {
		this.socket = socket
		this.userid = userid
		this.gameid = gameid
	}

	/**
	 * Sendet den Schuss an den Server.
	 * 
	 * Die Event-Struktur ('shoot') und die Payload 
	 * könnten sich ändern, sobald das Netzwerk-Protokoll finalisiert ist.
	 */
	sendShot(actorId: string, angle: number, power: number): void {
		console.info("Network Emitter", actorId, angle, power)
		// this.socket.send(wrap<NetworkShoot>({ type: NetworkMessageType.SHOOT, actorId, angle, power, userid: this.userid, gameid: this.gameid }))
	}
}
