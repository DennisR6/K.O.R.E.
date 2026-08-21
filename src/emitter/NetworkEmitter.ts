import { GameState, type IInputEmitter } from "../kore/runtime/types.js";
import type { GameHandler } from "../kore/runtime/Handler.js";
import { TurnSystem } from "../systems/TurnSystem.js";
import { wrap } from "../utils/net.js";
import { fingerprintAuthoritativeTurn } from "../net/turnStateHash.js";
import { NetworkMessageType, type NetworkCreateReplayShare, type NetworkShoot, type NetworkTurn, type UnTypedNetworkMessage } from "../server/types.js";
import type { NetworkGameEnded, NetworkItemUsed, NetworkPhaseChanged, NetworkReportMatch, NetworkSkipPhase, NetworkSurrenderGame, NetworkUseItem } from "../server/types.js";
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

	skipPhase(): void {
		this.socket.send(wrap<NetworkSkipPhase>({ type: NetworkMessageType.SKIP_PHASE }))
	}
	public requestReplayShare(): void { this.socket.send(wrap<NetworkCreateReplayShare>({ type: NetworkMessageType.CREATE_REPLAY_SHARE })); }
	public sendReport(category: NetworkReportMatch["category"], text: string): boolean {
		if (this.socket.readyState !== WebSocket.OPEN) return false;
		this.socket.send(wrap<NetworkReportMatch>({ type: NetworkMessageType.REPORT_MATCH, category, text }));
		return true;
	}
	public surrender(): boolean {
		if (this.socket.readyState !== WebSocket.OPEN) return false;
		this.socket.send(wrap<NetworkSurrenderGame>({ type: NetworkMessageType.SURRENDER_GAME }));
		return true;
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
			const sequence = turn.sequence ?? turn.turnNumber;
			if (sequence <= handler.getTurnNumber()) {
				handler.log("turnPacket.stale", { gameId: turn.gameId, sequence, currentTurnNumber: handler.getTurnNumber(), stateHash: turn.stateHash });
				return;
			}
			handler.setRuleState(turn.ruleState)
			handler.log("turnPacket.received", { gameId: turn.gameId, sequence, turnNumber: turn.turnNumber, stateHash: turn.stateHash, actorId: turn.sim.actorId, frameCount: turn.sim.durationFrames, playerCount: turn.sim.finalState.length });
			handler.playTurn(turn.sim, () => {
				if (turn.matchResult) handler.setMatchResult(turn.matchResult);
				handler.setState(turn.gameOver ? GameState.Game_over : TurnSystem.stateForTeam(turn.activeTeam, handler.getTeam()))
				const localStateHash = fingerprintAuthoritativeTurn({ players: handler.getEntityManager().serialize(), state: handler.getState(), turnNumber: turn.turnNumber, activeTeam: turn.activeTeam, ruleState: handler.getRuleState(), matchResult: handler.getMatchResult() });
				let synchronizedHash = localStateHash;
				const hashMatches = turn.stateHash === undefined || turn.stateHash === localStateHash;
				if (!hashMatches) {
					// The server's final player state is authoritative. Playback normally
					// reaches it through the hard-sync path, but explicitly restoring it
					// here repairs drift caused by a missed local effect or old client
					// build instead of leaving the client in a divergent match.
					handler.getEntityManager().applySettings(turn.sim.finalState);
					synchronizedHash = fingerprintAuthoritativeTurn({ players: handler.getEntityManager().serialize(), state: handler.getState(), turnNumber: turn.turnNumber, activeTeam: turn.activeTeam, ruleState: handler.getRuleState(), matchResult: handler.getMatchResult() });
					handler.log("turnPacket.resynchronized", { gameId: turn.gameId, sequence, turnNumber: turn.turnNumber, expectedStateHash: turn.stateHash, repairedStateHash: synchronizedHash, preSyncDrift: handler.getLastPositionDrift() });
				}
				handler.log(hashMatches ? "turnPacket.synchronized" : "turnPacket.hash-mismatch", { gameId: turn.gameId, sequence, turnNumber: turn.turnNumber, expectedStateHash: turn.stateHash, actualStateHash: synchronizedHash, hashMatches: turn.stateHash === undefined || turn.stateHash === synchronizedHash, preSyncDrift: handler.getLastPositionDrift() });
			})
		}
		if (message.type === NetworkMessageType.ITEM_USED) {
			const itemUse = message as NetworkItemUsed
			handler.getEntityManager().applySettings(itemUse.players)
			handler.setRuleState(itemUse.ruleState)
			handler.setState(TurnSystem.stateForTeam(itemUse.ruleState.activeTeam, handler.getTeam()))
		}
		if (message.type === NetworkMessageType.PHASE_CHANGED) {
			handler.setRuleState((message as NetworkPhaseChanged).ruleState)
			handler.setState(TurnSystem.stateForTeam((message as NetworkPhaseChanged).ruleState.activeTeam, handler.getTeam()))
		}
		if (message.type === NetworkMessageType.ERROR) {
			console.warn("Server rejected input:", message.message)
			// A rejected shot must not leave the client in Waiting_for_server.
			// Restore the locally controlled turn from the authoritative active team.
			handler.setState(TurnSystem.stateForTeam(handler.getActiveTeam(), handler.getTeam()))
		}
		if (message.type === NetworkMessageType.GAME_ENDED) {
			const ended = message as NetworkGameEnded;
			if (ended.players) handler.getEntityManager().applySettings(ended.players);
			if (ended.result) handler.setMatchResult(ended.result);
			handler.setState(GameState.Game_over);
		}
	})
}
