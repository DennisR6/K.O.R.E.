import type { IDrawer, RenderContext } from "../engine/RenderContext.js";
import type { IMouse } from "../engine/types.js";
import type { Vector2D } from "../physics/physics.js";
import type { IGameContext, ISystem } from "./types.js";

export interface IUiSystem extends ISystem, IDrawer, IMouse {
}
export class UiSystem implements IUiSystem {
	team: string[]
	dragStart: Vector2D & { actorId: number } | null = null
	currentMouse: Vector2D | null = null
	constructor(team: string[]) { this.team = team }

	ticker(_ctx: IGameContext, _dt: number, _friction: number): void { }
	draw(_ctx: RenderContext): void { }
	handleMouseWheel(_event: WheelEvent): void { }
	handleMousePressed(_mouseX: number, _mouseY: number): void { }
	handleMouseReleased(): void { }
	handleMouseRotation(_isUp: boolean): void { }
	updateMouse(_mouseX: number, _mouseY: number): void { }
	getCurrentMousePosition(): Vector2D { return { x: 0, y: 0 } }
	setCurrentMousePosition(_pos: Vector2D): void { }
	getTeam(): string[] {
		return this.team ?? []
	}
}
