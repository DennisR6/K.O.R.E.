import { GameState, type IInputEmitter } from "../engine/types.js";
import type { GameHandler } from "../engine/Handler.js";
import { wrap } from "../utils/net.js";
import { NetworkMessageType, type NetworkShoot, type NetworkTurn, type UnTypedNetworkMessage } from "../server/types.js";

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
	sendShot(actorId: string, angle: number, power: number): void {
		this.socket.send(wrap<NetworkShoot>({ type: NetworkMessageType.SHOOT, actorId, angle, power }))
	}
}

/** Installs the authoritative TURN receiver for a client-side handler. */
export function installTurnReceiver(socket: WebSocket, handler: GameHandler): void {
	socket.addEventListener("message", event => {
		let message: UnTypedNetworkMessage
		try {
			message = JSON.parse(String(event.data)) as UnTypedNetworkMessage
		} catch {
			console.warn("Ignoring malformed server packet")
			return
		}
		if (message.type === NetworkMessageType.TURN) {
			const turn = message as NetworkTurn
			handler.setTurnNumber(turn.turnNumber)
			handler.playTurn(turn.sim, () => {
				handler.setState(handler.getTeam().includes(turn.activeTeam)
					? GameState.Your_turn
					: GameState.Opponents_turn)
			})
		}
		if (message.type === NetworkMessageType.ERROR) console.warn("Server rejected input:", message.message)
	})
}
