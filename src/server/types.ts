import type { UUID } from "crypto"
import type { EngineSettings, IInput, TurnPacket } from "../engine/types.js"
import type { RuleState } from "../rules/types.js"
export const enum NetworkMessageType {
	PING = "PING",
	PONG = "PONG",
	INIT = "INIT",
	GAME = "GAME",
	SHOOT = "SHOOT",
	LOGIN = "LOGIN",
	NEWUSER = "NEWUSER",
	WAITINGROOM = "WAITINGROOM",
	TURN = "TURN",
	ERROR = "ERROR",
	REMATCH = "REMATCH",
}

export function getNetworkPacketType(input: NetworkMessageType): string {
	switch (input) {
		case NetworkMessageType.PING: return "Ping"
		case NetworkMessageType.PONG: return "Pong"
		case NetworkMessageType.INIT: return "Init"
		case NetworkMessageType.GAME: return "Game"
		case NetworkMessageType.SHOOT: return "Shoot"
		case NetworkMessageType.LOGIN: return "Login"
		case NetworkMessageType.WAITINGROOM: return "Waitingroom"
		case NetworkMessageType.TURN: return "Turn"
		case NetworkMessageType.ERROR: return "Error"
		case NetworkMessageType.NEWUSER: return "New User"
		default: return `NetworkMessageType: ${input}`
	}

}
export type UnTypedNetworkMessage =
	NetworkPing |
	NetworkPong |
	NetworkInit |
	NetworkShoot |
	NetworkLogin |
	NetworkGame |
	NetworkWaitingRoom |
	NetworkTurn |
	NetworkNewUser |
	NetworkError
	| NetworkRematch

export interface NetworkPing { type: NetworkMessageType.PING }
export interface NetworkPong { type: NetworkMessageType.PONG }
export interface NetworkInit { type: NetworkMessageType.INIT, settings: EngineSettings, ruleState: RuleState }
export interface NetworkShoot extends IInput {
	type: NetworkMessageType.SHOOT
}
export interface NetworkLogin {
	type: NetworkMessageType.LOGIN,
	userid: UUID | undefined,
}
export interface NetworkGame {
	type: NetworkMessageType.GAME,
	id: UUID
}
export interface NetworkWaitingRoom { type: NetworkMessageType.WAITINGROOM }
export interface NetworkTurn {
	type: NetworkMessageType.TURN,
	sim: TurnPacket,
	turnNumber: number,
	activeTeam: number,
	ruleState: RuleState,
}
export interface NetworkError {
	type: NetworkMessageType.ERROR,
	message: string
}
export interface NetworkRematch { type: NetworkMessageType.REMATCH }
export interface NetworkNewUser { type: NetworkMessageType.NEWUSER, userid: UUID }
export interface WebSocketData { connectionId: UUID }
