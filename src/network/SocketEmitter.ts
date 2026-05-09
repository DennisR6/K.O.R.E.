import { Socket } from "socket.io-client"; // Oder dein entsprechender Typ
import type { IInputEmitter } from "../engine/types";

export class SocketEmitter implements IInputEmitter {
	socket
	constructor(socket: Socket) {
		this.socket = socket
	}

	/**
	 * Sendet den finalen Schuss-Befehl an den Server.
	 * @param angle Der berechnete Winkel in Grad (0-360)
	 * @param power Die Kraft in Prozent (0-100)
	 */
	public sendShot(actorId: number | string, angle: number, power: number): void {
		if (!this.socket || !this.socket.connected) {
			console.error("SocketEmitter: Schuss konnte nicht gesendet werden. Keine Verbindung.");
			return;
		}

		this.socket.emit('shoot', {
			actorId: actorId,
			angle: angle,
			power: power
		});

		console.log(`📡 Shot emitted: ${angle}° with ${power}% power`);
	}
}
