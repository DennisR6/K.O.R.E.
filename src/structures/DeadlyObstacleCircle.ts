import type { RenderContext } from "../engine/RenderContext.js";
import { Player } from "../entity/Player.js";
import type { IPhysics } from "../physics/physics.js";
import { StructureCircle } from "./structureCircle.js";

export class DeadlyObstacleCirle extends StructureCircle {
	constructor(x: number, y: number, r: number, color?: string) {
		super(x, y, r, color)
	}

	public onCollision({ entity }: { entity: IPhysics; }): void {
		if (entity instanceof Player) { entity.addHP(-100); return }
		console.log("Collision", entity, entity instanceof Player)
	}

	public override draw(_ctx: RenderContext): void {
		// ctx.push()
		// ctx.setFillColor(this.getColor())
		// ctx.setStrokeColor(this.getColor())

		// const { x, y } = this.getPos()
		// const { x: r } = this.getBounds()
		// ctx.drawCircle(x, y, r * 2)
		// ctx.pop()
	}
}
