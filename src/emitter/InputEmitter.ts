import { type IInputEmitter } from "../engine/types";
import { GameLogger } from "../utils/log";

export class CombiEmitter implements IInputEmitter {
	private emitters: IInputEmitter[] = [];

	constructor(emitters: IInputEmitter[]) {
		this.emitters = emitters;
	}

	sendShot(actorId: string | number, angle: number, power: number): void {
		this.emitters.forEach(e => e.sendShot(actorId, angle, power));
	}
	addEmitter(emitter: IInputEmitter) {
		this.emitters.push(emitter)
	}
}

export class LogEmitter implements IInputEmitter {
	constructor() {
	}
	sendShot(actorId: string | number, angle: number, power: number) {
		console.log({ actorId, angle, power })
		GameLogger.debug("TURN", { actorId, angle, power })
	}
}
