import type { RenderContext } from "../kore/runtime/RenderContext.js";
import { BackgroundColorSystem } from "./Background.js";

export class CustomDrawableBackground extends BackgroundColorSystem {
	constructor() {
		const testColors = [
			"#A0785A",
			"#5A321E",
			"#DCC696",
		]
		super(testColors[1])
	}
	public tick(_deltatime: number, _globalfriction: number): void {

	}
	public draw(ctx: RenderContext): void {
		ctx.clear(this.getColor())
		ctx.setFillColor("brown")
	}
}
