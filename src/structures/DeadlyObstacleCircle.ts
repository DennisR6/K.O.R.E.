import type { RenderContext } from "../engine/RenderContext.js";
import type { IEntity } from "../entity/Entity.js";
import { Player } from "../entity/Player.js";
import { StructureCircle } from "./structureCircle.js";

export class DeadlyObstacleCirle extends StructureCircle {
	constructor(x: number, y: number, r: number, color?: string) {
		super(x, y, r, color)
	}

	public onCollision({ entity }: { entity: IEntity }): void {
		console.log("test")
		if (!(entity instanceof Player)) return
		console.log("test2")
		entity.addHP(-100);
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
