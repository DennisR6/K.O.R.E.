import type { IDrawer, ITicker, RenderContext } from "../engine/RenderContext";
import type { IMouse } from "../engine/types";
import type { Vector2D } from "../physics/physics";

export class Builder implements IDrawer, ITicker, IMouse {
	position: Vector2D = { x: 0, y: 0 }
	constructor() { }
	handleMousePressed(mouseX: number, mouseY: number): void {
		console.log(mouseX, mouseY)
	}
	handleMouseReleased(_cb?: (actorId: string, angle: number, power: number) => void): void {
	}
	handleMouseWheel(event: WheelEvent): void {
		console.log(event)
	}
	tick(deltatime: number, globalfriction: number): void {
		console.log(deltatime, globalfriction)
	}
	updateMouse(mouseX: number, mouseY: number): void {
		console.log(mouseX, mouseY)

	}
	draw(ctx: RenderContext): void {
		ctx.drawCircle(20, 20, 20)
	}
	getCurrentMousePosition(): Vector2D {
		return { x: 12, y: 12 }
	}
	setCurrentMousePosition(pos: Vector2D): void {
		console.log(pos)
	}
	getTeam(): string[] {
		return []
	}
}
