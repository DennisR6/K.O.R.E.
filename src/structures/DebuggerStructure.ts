import type { RenderContext } from "../engine/RenderContext.js";
import { StructureCircle } from "./structureCircle.js"

export class DebugStructure extends StructureCircle {
	structure: StructureCircle
	constructor(str: StructureCircle) {
		super(str.getPos().x, str.getPos().y, str.getBounds().x, str.getColor())
		this.structure = str;
	}
	public override draw(ctx: RenderContext): void {
		super.draw(ctx)

		const { x, y } = this.structure.getPos()
		const { x: r } = this.structure.getBounds()

		ctx.line(x - r, y - r, x + r, y - r)
		ctx.line(x + r, y + r, x + r, y - r)
		ctx.line(x - r, y + r, x - r, y - r)
		ctx.line(x - r, y + r, x + r, y + r)
	}

}
