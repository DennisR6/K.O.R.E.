import { GameState, type IInputEmitter } from "../engine/types.js";
import type { GameHandler } from "../engine/Handler.js";
import { TurnSystem } from "../systems/TurnSystem.js";
import { wrap } from "../utils/net.js";
import { NetworkMessageType, type NetworkCreateReplayShare, type NetworkShoot, type NetworkTurn, type UnTypedNetworkMessage } from "../server/types.js";
import type { NetworkItemUsed, NetworkUseItem } from "../server/types.js";
import type { ItemTarget } from "../item/target.js";

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

	sendItemUse(actorId: string, itemId: string, target: ItemTarget): void {
		this.socket.send(wrap<NetworkUseItem>({ type: NetworkMessageType.USE_ITEM, actorId, itemId, target }))
	}
	public requestReplayShare(): void { this.socket.send(wrap<NetworkCreateReplayShare>({ type: NetworkMessageType.CREATE_REPLAY_SHARE })); }
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
			handler.setRuleState(turn.ruleState)
			handler.log("turnPacket.received", { actorId: turn.sim.actorId, frameCount: turn.sim.durationFrames, playerCount: turn.sim.finalState.length });
			handler.playTurn(turn.sim, () => {
				handler.setState(turn.gameOver ? GameState.Game_over : TurnSystem.stateForTeam(turn.activeTeam, handler.getTeam()))
		})
		}
		if (message.type === NetworkMessageType.ITEM_USED) {
			const itemUse = message as NetworkItemUsed
			handler.getEntityManager().applySettings(itemUse.players)
			handler.setRuleState(itemUse.ruleState)
			handler.setState(TurnSystem.stateForTeam(itemUse.ruleState.activeTeam, handler.getTeam()))
		}
		if (message.type === NetworkMessageType.ERROR) console.warn("Server rejected input:", message.message)
	})
}
