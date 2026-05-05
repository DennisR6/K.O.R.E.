import type { IDrawer, IRenderer, RenderContext } from "../engine/RenderContext";
import type { IMouse } from "../engine/types";

export class Mouse implements IDrawer, IRenderer, IMouse {
	constructor() {
	}
	draw(_ctx: RenderContext): void {

	}
	update(_deltatime: number, _globalfriction: number): void {

	}
	handleMousePressed(_mouseX: number, _mouseY: number): void {

	}
	handleMouseReleased(): void {

	}
	updateMouse(_mouseX: number, _mouseY: number): void {

	}

}
