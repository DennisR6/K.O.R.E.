import type { RenderContext } from "../engine/RenderContext";
import type { IEntity } from "../entity/Entity";
import { Player } from "../entity/Player";
import { StructureCircle } from "./structureCircle";

export class ReduceFrictionCircle extends StructureCircle {
	constructor(x: number, y: number, r: number, color?: string) { super(x, y, r, color) }

	public onCollision({ entity }: { entity: IEntity }): void {
		if (!(entity instanceof Player)) return
		entity.setFriction(0.3)
		return
	}

	public override draw(ctx: RenderContext): void {
		if (!this.getColor()) return

		ctx.push()
		ctx.setFillColor(this.getColor()!)
		ctx.setStrokeColor(this.getColor()!)

		const { x, y } = this.getPos()
		const { x: r } = this.getBounds()
		ctx.drawCircle(x, y, r * 2)
		ctx.pop()
	}
}
