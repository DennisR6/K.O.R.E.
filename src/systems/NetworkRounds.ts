import { Socket } from "socket.io-client"
import type { NoRoundSystem } from "./RoundSystem";
import type { IGameContext } from "./types";

export class NetworkRoundSystem implements NoRoundSystem {
	socket: Socket
	cb: () => void
	turn: boolean
	constructor(socket: Socket, cb: () => void) {
		this.socket = socket
		this.cb = cb
		this.turn = false
		this.socket.on("turn", (data) => {
			console.log(data)
		})
	}

	tick(ctx: IGameContext, _dt: number): void {
	}
}
