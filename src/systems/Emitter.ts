import { LogEmitter } from "../emitter/InputEmitter.js";
import { GameState, type IInputEmitter } from "../engine/types.js";
import type { IGameContext, ISerializableSystem, SystemSettings } from "./types.js";

export class EmitterSystem implements ISerializableSystem<SystemSettings> {
	public readonly systemId = "core.emitter";
	emitter: IInputEmitter
	constructor(em?: IInputEmitter, private onError?: (error: unknown) => void) {
		if (em) this.emitter = em
		else this.emitter = new LogEmitter()
	}
	public setEmitter(emitter: IInputEmitter): void { this.emitter = emitter }
	/** Installs a host feedback hook without making the emitter itself a UI dependency. */
	public setErrorHandler(onError: ((error: unknown) => void) | undefined): void { this.onError = onError }
	public toSettings(): SystemSettings { return { systemId: this.systemId, schemaVersion: 1, state: {} }; }

	ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		if (ctx.state !== GameState.Turn_done) return
		if (!ctx.mouse.turn) {
			return
		}
		const { actorId, angle, power } = ctx.mouse.turn
		try {
			this.emitter.sendShot(actorId, angle, power)
		} catch (error) {
			ctx.log?.("input.rejected", { actionType: "shot", actorId, angle, power, reason: error instanceof Error ? error.message : String(error) });
			this.onError?.(error)
			ctx.state = GameState.Your_turn
			return
		}
		// Network emitters are asynchronous. A local emitter may already have
		// started playback, which must not be overwritten with a wait state.
		if (ctx.state === GameState.Turn_done) ctx.state = GameState.Waiting_for_server
	}
}
