import type { IDrawer, RenderContext } from "../engine/RenderContext.js";
import type { IMouse } from "../engine/types.js";
import type { Vector2D } from "../physics/physics.js";
import type { IGameContext, ISystem } from "./types.js";

export interface IUiSystem extends ISystem, IDrawer, IMouse {
}
export class UiSystem implements IUiSystem {
	dragStart: Vector2D & { actorId: number } | null = null
	currentMouse: Vector2D | null = null

	ticker(_ctx: IGameContext, _dt: number, _friction: number): void { }
	draw(_ctx: RenderContext): void { }
	handleMouseWheel(_event: WheelEvent): void { }
	handleMousePressed(_mouseX: number, _mouseY: number): void { }
	handleMouseReleased(): void { }
	handleMouseRotation(_isUp: boolean): void { }
	updateMouse(_mouseX: number, _mouseY: number): void { }
}
