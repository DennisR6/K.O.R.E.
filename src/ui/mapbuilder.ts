import type { IDrawer, ITicker, RenderContext } from "../kore/runtime/RenderContext";
import type { IMouse } from "../kore/runtime/types";
import type { Vector2D } from "@coffeemakerstudio/bean";

export class Builder implements IDrawer, ITicker, IMouse {
	position: Vector2D = { x: 0, y: 0 }
	constructor() { }
	handleMousePressed(): void { }
	handleMouseReleased(_cb?: (actorId: string, angle: number, power: number) => void): void {
	}
	handleMouseWheel(_event: WheelEvent): void { }
	tick(_deltatime: number, _globalfriction: number): void { }
	updateMouse(_mouseX: number, _mouseY: number): void { }
	draw(ctx: RenderContext): void {
		ctx.drawCircle(20, 20, 20)
	}
}
