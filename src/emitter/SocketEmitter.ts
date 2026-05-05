import type { IInputEmitter } from "../engine/types";

export class SocketEmitter implements IInputEmitter {
	socket: any
	constructor(socket: any) {
		this.socket = socket
	}

	sendShot(angle: number, power: number): void {
		this.socket.emit('shoot', { angle, power });
	}
}
