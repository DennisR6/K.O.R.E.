import { Socket } from "socket.io-client"
import type { NoRoundSystem } from "./RoundSystem.js";
import type { IGameContext } from "./types.js";
import { GameLogger } from "../utils/log.js";

export class NetworkRoundSystem implements NoRoundSystem {
	socket: Socket
	cb: () => void
	turn: boolean
	constructor(socket: Socket, cb: () => void) {
		this.socket = socket
		this.cb = cb
		this.turn = false
		this.socket.on("turn", (data) => { GameLogger.info(data) })
	}

	ticker(_ctx: IGameContext, _dt: number): void { }
}
