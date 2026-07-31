import { LogEmitter } from "../emitter/InputEmitter.js";
import { GameState, type IInputEmitter } from "../engine/types.js";
import type { IGameContext, ISystem } from "./types.js";

export class EmitterSystem implements ISystem {
	emitter: IInputEmitter
	constructor(em?: IInputEmitter, private readonly onError?: (error: unknown) => void) {
		if (em) this.emitter = em
		else this.emitter = new LogEmitter()
	}

	ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		if (ctx.state !== GameState.Turn_done) return
		if (!ctx.mouse.turn) {
			console.log("no turn data found!")
			return
		}
		const { actorId, angle, power } = ctx.mouse.turn
		try {
			this.emitter.sendShot(actorId, angle, power)
		} catch (error) {
			this.onError?.(error)
			ctx.state = GameState.Your_turn
			return
		}
		console.log("sendShot")
		// Network emitters are asynchronous. A local emitter may already have
		// started playback, which must not be overwritten with a wait state.
		if (ctx.state === GameState.Turn_done) ctx.state = GameState.Waiting_for_server
	}
}
