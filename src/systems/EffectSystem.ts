import type { IExtendedTicker } from "../engine/RenderContext.js";
import { GameState } from "../engine/types.js";
import type { IGameContext, ISerializableSystem, SystemSettings } from "./types.js";

export class EffectSystem implements ISerializableSystem<SystemSettings>, IExtendedTicker {
	public readonly systemId = "core.effects";
	private newRound: boolean
	constructor(newRound: boolean = false) { this.newRound = newRound }
	public toSettings(): SystemSettings { return { systemId: this.systemId, schemaVersion: 1, state: { newRound: this.newRound } }; }
	ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		if (ctx.state === GameState.Turn_done) { this.newRound = true; return }
		if (!this.newRound) return
		console.log("new Round", this.newRound)
	}
	preTick(_ctx: IGameContext, _deltatime: number, _globalfriction: number): void { }
	tick(_ctx: IGameContext, _deltatime: number, _globalfriction: number): void { }
	postTick(_ctx: IGameContext, _deltatime: number, _globalfriction: number): void { }
}
