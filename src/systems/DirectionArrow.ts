import type { IDrawer, RenderContext } from "../engine/RenderContext.js";
import type { IGameContext, ISystem } from "./types.js";

export class DirectionArrow implements IDrawer, ISystem {
	constructor() { }

	public draw(_ctx: RenderContext): void {
		// ctx.drawCircle(200, 200, 12)
		// console.log(this.player)
	}
	public ticker(_ctx: IGameContext, _dt: number, _friction: number): void {
		// console.log(ctx.mouse)
		// ctx.mouse.turn
		// if (!this.player) return
		// this.start = this.player.getPos()
		// this.end = ctx.mouse.end
		// if (!ctx.mouse.released) return
		// ctx.state = GameState.Turn_done
		// ctx.mouse.pressed = false
		// ctx.mouse.released = false
	}
}
