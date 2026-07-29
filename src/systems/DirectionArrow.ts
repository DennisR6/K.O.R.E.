import type { IDrawer, RenderContext } from "../engine/RenderContext.js";
import { GameState } from "../engine/types.js";
import type { IGameContext, ISystem } from "./types.js";
import type { UiSystem } from "./UiSystem.js";

export class DirectionArrow implements IDrawer, ISystem {
	private context: IGameContext | undefined

	constructor(private readonly input: UiSystem) { }

	public draw(renderer: RenderContext): void {
		const context = this.context
		if (!context) return

		const team = this.getActiveTeam(context)
		const color = team === 0 ? "#38bdf8" : "#fb7185"
		renderer.push()
		renderer.setFillColor(color)
		renderer.drawText(this.getTurnLabel(context, team), 20, 36, 24)

		if (team !== undefined) {
			context.entities.getEntities()
				.filter(entity => !entity.isDead() && entity.getTeam().includes(team))
				.forEach(entity => {
					const position = entity.getPos()
					renderer.drawCircle(position.x, position.y - entity.getBounds().x - 8, 4)
				})
		}

		this.drawAimArrow(renderer, context, color)
		renderer.pop()
	}
	public ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		this.context = ctx
	}

	private drawAimArrow(renderer: RenderContext, context: IGameContext, color: string): void {
		if (context.state !== GameState.Your_turn || !this.input.start || this.input.end) return
		const actor = context.entities.getEntityAt(this.input.start.x, this.input.start.y)
		if (!actor || actor.isDead()) return

		// The shot launches away from the drag endpoint, matching UiSystem's angle.
		const dx = this.input.start.x - this.input.currentMouse.x
		const dy = this.input.start.y - this.input.currentMouse.y
		const length = Math.hypot(dx, dy)
		if (length < 1) return
		const direction = { x: dx / length, y: dy / length }
		const start = actor.getPos()
		const arrowLength = Math.min(100, Math.max(35, length))
		const end = { x: start.x + direction.x * arrowLength, y: start.y + direction.y * arrowLength }
		const headLength = 12
		const left = rotate(direction, (Math.PI * 3) / 4)
		const right = rotate(direction, -(Math.PI * 3) / 4)

		renderer.setStrokeColor(color)
		renderer.line(start.x, start.y, end.x, end.y)
		renderer.line(end.x, end.y, end.x + left.x * headLength, end.y + left.y * headLength)
		renderer.line(end.x, end.y, end.x + right.x * headLength, end.y + right.y * headLength)
	}

	private getActiveTeam(context: IGameContext): number | undefined {
		if (context.state !== GameState.Your_turn && context.state !== GameState.Opponents_turn) return undefined
		return context.activeTeam
	}

	private getTurnLabel(context: IGameContext, team: number | undefined): string {
		if (team === undefined) return "Waiting for turn"
		return context.state === GameState.Your_turn
			? `Your turn: Team ${team + 1}`
			: `Opponent turn: Team ${team + 1}`
	}
}

function rotate(vector: { x: number, y: number }, angle: number): { x: number, y: number } {
	return {
		x: vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
		y: vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
	}
}
