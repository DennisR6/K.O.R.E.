import type { IDrawer, RenderContext } from "../engine/RenderContext";
import type { IMouse } from "../engine/types";
import type { Vector2D } from "../physics/physics";
import type { IGameContext, ISystem } from "./types";

export interface IUiSystem extends ISystem, IDrawer, IMouse {
}
export class UiSystem implements IUiSystem {
	dragStart: Vector2D & { actorId: number } | null = null
	currentMouse: Vector2D | null = null

	tick(_ctx: IGameContext, _dt: number, _friction: number): void { }
	draw(_ctx: RenderContext): void { }
	handleMouseWheel(_event: WheelEvent): void { }
	handleMousePressed(_mouseX: number, _mouseY: number): void { }
	handleMouseReleased(): void { }
	handleMouseRotation(_isUp: boolean): void { }
	updateMouse(_mouseX: number, _mouseY: number): void { }
}
