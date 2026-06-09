import type { UUID } from "crypto"
import type { IInput, TurnPacket } from "../engine/types.js"
import type { GameSettings } from "../settings/settings.js"
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

export interface NetworkPing { type: NetworkMessageType.PING }
export interface NetworkPong { type: NetworkMessageType.PONG }
export interface NetworkInit { type: NetworkMessageType.INIT, settings: GameSettings }
export interface NetworkShoot extends IInput {
	type: NetworkMessageType.SHOOT
	userid: UUID,
	gameid: UUID
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
}
export interface NetworkError {
	type: NetworkMessageType.ERROR,
	message: string
}
export interface NetworkNewUser { type: NetworkMessageType.NEWUSER, userid: UUID }
export interface WebSocketData { accesstoken: UUID }
