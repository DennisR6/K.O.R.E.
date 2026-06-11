import type { IDrawer, RenderContext } from "../engine/RenderContext.js";
import { GameState } from "../engine/types.js";
import type { IEntity } from "../entity/Entity.js";
import type { Vector2D } from "../physics/physics.js";
import type { IGameContext, ISystem } from "./types.js";

export class DirectionArrow implements IDrawer, ISystem {
	start: Vector2D
	end: Vector2D
	player: IEntity | undefined
	constructor() {
		this.start = { x: 0, y: 0 }
		this.end = { x: 0, y: 0 }
	}

	public draw(ctx: RenderContext): void {
		if (!this.player) return
		ctx.push()
		ctx.setStroke(4)
		ctx.line(
			this.start.x,
			this.start.y,
			this.start.x - (this.end.x - this.start.x),
			this.start.y - (this.end.y - this.start.y),
		)
		ctx.pop()
	}
	public ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		if (ctx.state !== GameState.Your_turn) {
			this.player = undefined
			return
		}
		this.player = ctx.entities.getEntityAt(ctx.mouse.start.x, ctx.mouse.start.y, 24)
		if (!this.player) return
		this.start = this.player.getPos()
		this.end = ctx.mouse.end
		if (!ctx.mouse.released) return
		ctx.state = GameState.Turn_done
		ctx.mouse.pressed = false
		ctx.mouse.released = false
	}
}
