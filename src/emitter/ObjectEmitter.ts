import type { IInput, IInputEmitter } from "../engine/types";

export class ObjectEmitter implements IInputEmitter {
	lastShot: IInput | undefined
	sendShot(actorId: string | number, angle: number, power: number): void {
		this.lastShot = { actorId, angle, power }

	}
	getLastShot(): IInput | undefined {
		return this.lastShot
	}
}
